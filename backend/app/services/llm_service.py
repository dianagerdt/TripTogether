import json
from pathlib import Path
from typing import List
from openai import OpenAI
from app.config import settings
from app.models import Trip, PlacePreference


def load_system_prompt() -> str:
    """Load the system prompt from file."""
    prompt_path = Path(__file__).parent.parent / "prompts" / "trip_planner.md"
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read()


def build_user_prompt(trip: Trip, preferences: List[PlacePreference]) -> str:
    """Build the user prompt with trip data and preferences."""
    lines = [
        f"## Trip Information",
        f"- Title: {trip.title}",
    ]
    
    # Add description if provided
    if trip.description:
        lines.append(f"- Description: {trip.description}")
    
    lines.extend([
        f"- Start Date: {trip.start_date}",
        f"- End Date: {trip.end_date}",
        f"- Duration: {(trip.end_date - trip.start_date).days + 1} days",
        "",
        f"## Participant Preferences ({len(preferences)} total)",
        ""
    ])
    
    for pref in preferences:
        location_str = f", {pref.location}" if pref.location else ""
        comment_str = f' - "{pref.comment}"' if pref.comment else ""
        lines.append(
            f"- {pref.city}, {pref.country}{location_str} "
            f"[{pref.place_type.value}] "
            f"Priority: {pref.priority}/5 "
            f"(by {pref.user.username}){comment_str}"
        )
    
    return "\n".join(lines)


def parse_llm_response(content: str) -> List[dict]:
    """Parse LLM response into route options."""
    # The LLM will respond with structured text. We'll parse it into route options.
    # For simplicity, we'll ask LLM to respond in a specific format and parse it.
    
    routes = []
    current_route = None
    current_section = None
    
    for line in content.split("\n"):
        line = line.strip()
        
        # Detect new route option
        if line.startswith("### Вариант") or line.startswith("### Option"):
            if current_route:
                routes.append(current_route)
            current_route = {
                "title": "",
                "description": "",
                "reasoning": "",
            }
            # Extract title from the same line if present
            parts = line.split(":", 1)
            if len(parts) > 1:
                current_route["title"] = parts[1].strip()
            current_section = "title"
        
        elif current_route:
            # Detect sections
            if "Маршрут:" in line or "Itinerary:" in line or "День" in line or "Day " in line:
                current_section = "description"
            elif "Обоснование:" in line or "Reasoning:" in line or "Почему" in line:
                current_section = "reasoning"
            
            # Add content to current section
            if current_section == "description":
                current_route["description"] += line + "\n"
            elif current_section == "reasoning":
                current_route["reasoning"] += line + "\n"
            elif current_section == "title" and not current_route["title"] and line:
                current_route["title"] = line
    
    # Don't forget the last route
    if current_route:
        routes.append(current_route)
    
    # Clean up
    for route in routes:
        route["description"] = route["description"].strip()
        route["reasoning"] = route["reasoning"].strip()
        if not route["title"]:
            route["title"] = f"Вариант {routes.index(route) + 1}"
    
    return routes


async def generate_routes(trip: Trip, preferences: List[PlacePreference]) -> List[dict]:
    """Generate route options using DeepSeek API."""
    if not settings.deepseek_api_key:
        raise ValueError("DeepSeek API key is not configured")
    
    client = OpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url
    )
    
    system_prompt = load_system_prompt()
    user_prompt = build_user_prompt(trip, preferences)
    
    try:
        response = client.chat.completions.create(
            model=settings.deepseek_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=3000,
        )
    except Exception as e:
        # Re-raise with more context for DeepSeek API errors
        error_msg = str(e)
        if "insufficient_quota" in error_msg or "429" in error_msg:
            raise Exception(f"Error code: 429 - {str(e)}")
        elif "rate_limit" in error_msg.lower():
            raise Exception(f"Error code: 429 - Rate limit exceeded: {str(e)}")
        elif "invalid_api_key" in error_msg.lower() or "authentication" in error_msg.lower():
            raise Exception(f"Error code: 401 - Invalid API key: {str(e)}")
        else:
            raise Exception(f"DeepSeek API error: {str(e)}")
    
    content = response.choices[0].message.content
    routes = parse_llm_response(content)
    
    # Fallback if parsing failed
    if not routes:
        routes = [{
            "title": "Предложенный маршрут",
            "description": content,
            "reasoning": "Маршрут сгенерирован на основе ваших пожеланий.",
        }]
    
    return routes


def load_place_suggestions_prompt(country: str, city: str) -> str:
    """Load place suggestions prompt from file and substitute country/city."""
    prompt_path = Path(__file__).parent.parent / "prompts" / "place_suggestions.md"
    with open(prompt_path, "r", encoding="utf-8") as f:
        template = f.read()
    return template.replace("{{country}}", country).replace("{{city}}", city)


async def suggest_places(country: str, city: str) -> List[dict]:
    """Suggest popular places for a city. Returns list of {name, place_type}."""
    if not settings.deepseek_api_key:
        raise ValueError("DeepSeek API key is not configured")
    country = (country or "").strip()
    city = (city or "").strip()
    if not country or not city:
        raise ValueError("country and city are required")

    client = OpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )
    user_prompt = load_place_suggestions_prompt(country, city)

    try:
        response = client.chat.completions.create(
            model=settings.deepseek_model,
            messages=[{"role": "user", "content": user_prompt}],
            temperature=0.5,
            max_tokens=800,
        )
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "rate_limit" in error_msg.lower():
            raise Exception(f"Rate limit: {e}")
        if "invalid_api_key" in error_msg.lower() or "authentication" in error_msg.lower():
            raise Exception(f"Invalid API key: {e}")
        raise Exception(f"API error: {e}")

    content = (response.choices[0].message.content or "").strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[-1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content.rsplit("```", 1)[0].strip()
    try:
        raw = json.loads(content)
    except json.JSONDecodeError:
        return []
    if not isinstance(raw, list):
        return []
    valid_types = {"museum", "park", "viewpoint", "food", "activity", "district", "other"}
    result = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("title")
        pt = (item.get("place_type") or "").strip().lower()
        if not name or pt not in valid_types:
            continue
        reason = item.get("reason") or item.get("why")
        if isinstance(reason, str):
            reason = reason.strip()[:200]  # limit length
        else:
            reason = None
        result.append({
            "name": str(name).strip(),
            "place_type": pt,
            "reason": reason or None,
        })
    return result[:10]


# --- Packing checklist ---

def load_packing_prompt() -> str:
    prompt_path = Path(__file__).parent.parent / "prompts" / "packing_list.md"
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read()


def build_packing_user_prompt(
    trip: Trip,
    winner_route_title: str,
    winner_route_description: str,
    places_from_route: str | None = None,
) -> str:
    duration = (trip.end_date - trip.start_date).days + 1
    lines = [
        f"Поездка: {trip.title}",
        f"Даты: {trip.start_date} — {trip.end_date}, {duration} дн.",
    ]
    if trip.description:
        lines.append(f"Описание поездки: {trip.description}")
    if places_from_route:
        lines.append(f"Страны и города маршрута (из пожеланий участников): {places_from_route}")
    lines.extend([
        "",
        f"Выбранный маршрут (набрал больше всего голосов): «{winner_route_title}»",
        "Описание маршрута:",
        (winner_route_description or "")[:2000],
    ])
    return "\n".join(lines)


def parse_packing_response(content: str) -> dict:
    """Parse LLM response into checklist content dict. Returns { categories: [ { name, items }, ... ] }."""
    content = (content or "").strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[-1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content.rsplit("```", 1)[0].strip()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return {"categories": []}
    if not isinstance(data, dict):
        return {"categories": []}
    cats = data.get("categories")
    if not isinstance(cats, list):
        return {"categories": []}
    result = []
    for c in cats:
        if not isinstance(c, dict):
            continue
        name = (c.get("name") or "").strip()
        items = c.get("items")
        if not name or not isinstance(items, list):
            continue
        result.append({
            "name": name,
            "items": [str(x).strip() for x in items if x][:15],
        })
    return {"categories": result}


async def generate_packing_list(
    trip: Trip,
    winner_route_title: str,
    winner_route_description: str,
    places_from_route: str | None = None,
) -> dict:
    """Generate packing checklist content using LLM. Returns dict for TripChecklist.content."""
    if not settings.deepseek_api_key:
        raise ValueError("DeepSeek API key is not configured")
    client = OpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )
    system_prompt = load_packing_prompt()
    user_prompt = build_packing_user_prompt(
        trip, winner_route_title, winner_route_description, places_from_route
    )
    try:
        response = client.chat.completions.create(
            model=settings.deepseek_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=1500,
        )
    except Exception as e:
        err = str(e).lower()
        if "429" in err or "rate_limit" in err:
            raise Exception("Превышен лимит запросов. Попробуйте позже.")
        if "api key" in err or "invalid" in err:
            raise Exception("Ошибка API. Проверьте настройки.")
        raise Exception(f"Ошибка генерации: {e}")
    text = (response.choices[0].message.content or "").strip()
    return parse_packing_response(text)
