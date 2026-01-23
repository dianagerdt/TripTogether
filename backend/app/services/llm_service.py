import json
from pathlib import Path
from typing import List
from openai import OpenAI
from app.config import settings
from app.models import Trip, PlacePreference


def load_system_prompt() -> str:
    """Load the system prompt from file."""
    prompt_path = Path(__file__).parent.parent / "prompts" / "trip_planner.txt"
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read()


def build_user_prompt(trip: Trip, preferences: List[PlacePreference]) -> str:
    """Build the user prompt with trip data and preferences."""
    lines = [
        f"## Trip Information",
        f"- Title: {trip.title}",
        f"- Start Date: {trip.start_date}",
        f"- End Date: {trip.end_date}",
        f"- Duration: {(trip.end_date - trip.start_date).days + 1} days",
        "",
        f"## Participant Preferences ({len(preferences)} total)",
        ""
    ]
    
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
    """Generate route options using OpenAI."""
    if not settings.openai_api_key:
        raise ValueError("OpenAI API key is not configured")
    
    client = OpenAI(api_key=settings.openai_api_key)
    
    system_prompt = load_system_prompt()
    user_prompt = build_user_prompt(trip, preferences)
    
    # Add format instructions
    format_instructions = """

## Response Format
Please structure your response exactly like this for each route option:

### Вариант 1: [Title]
**Маршрут:**
День 1: [activities]
День 2: [activities]
...

**Обоснование:**
[Your reasoning here]

### Вариант 2: [Title]
...

Provide 2-3 route options.
"""
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt + format_instructions},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.7,
        max_tokens=3000,
    )
    
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
