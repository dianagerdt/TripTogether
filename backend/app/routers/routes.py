from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.models import User, Trip, TripParticipant, PlacePreference, RouteOption, Vote, GenerationStatus, ParticipantRole
from app.schemas.route import RouteOptionResponse, GenerateRoutesResponse
from app.services.llm_service import generate_routes, explain_why_not_included
from app.utils.deps import get_current_user
from app.config import settings
import asyncio
import json

router = APIRouter()


def get_trip_or_404(trip_id: int, db: Session) -> Trip:
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Поездка не найдена")
    return trip


def check_user_is_participant(trip_id: int, user_id: int, db: Session) -> TripParticipant:
    participant = db.query(TripParticipant).filter(
        TripParticipant.trip_id == trip_id,
        TripParticipant.user_id == user_id
    ).first()
    if not participant:
        raise HTTPException(status_code=403, detail="Вы не являетесь участником этой поездки")
    return participant


def _normalize_for_match(s: str) -> str:
    if not s:
        return ""
    for c in "*#_`[]().,-—–":
        s = s.replace(c, " ")
    return " ".join(s.split()).strip().lower()


def _is_place_mentioned_in_route(route_text: str, location: str | None, city: str | None) -> bool:
    if not route_text:
        return False
    text = _normalize_for_match(route_text)
    loc = (location or "").strip()
    cit = (city or "").strip()
    # exact substring (location or city)
    if loc:
        nloc = _normalize_for_match(loc)
        if nloc and nloc in text:
            return True
    if cit:
        ncit = _normalize_for_match(cit)
        if ncit and ncit in text:
            return True
    # all significant words present (handles "Санкт-Петербург" vs "Санкт Петербург" in route)
    if loc:
        words = [w for w in _normalize_for_match(loc).split() if len(w) >= 2]
        if words and all(w in text for w in words):
            return True
    if cit:
        words = [w for w in _normalize_for_match(cit).split() if len(w) >= 2]
        if words and all(w in text for w in words):
            return True
    return False


@router.get("/{trip_id}/routes/{route_id}/preferences-not-in-route")
def get_preferences_not_in_route(
    trip_id: int,
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return preference IDs that are not mentioned in this route's text (for 'why not included' list)."""
    get_trip_or_404(trip_id, db)
    check_user_is_participant(trip_id, current_user.id, db)
    route = db.query(RouteOption).filter(
        RouteOption.id == route_id,
        RouteOption.trip_id == trip_id,
    ).first()
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    route_text_parts = [route.description or "", route.reasoning or ""]
    if getattr(route, "route_data", None) and isinstance(route.route_data, dict):
        route_text_parts.append(json.dumps(route.route_data, ensure_ascii=False))
    route_text = " ".join(route_text_parts)
    prefs = db.query(PlacePreference).filter(PlacePreference.trip_id == trip_id).all()
    not_in_route = [
        p.id
        for p in prefs
        if not _is_place_mentioned_in_route(route_text, p.location, p.city)
    ]
    return {"preference_ids": not_in_route}


@router.get("/{trip_id}/routes", response_model=List[RouteOptionResponse])
def get_routes(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all generated route options for a trip."""
    get_trip_or_404(trip_id, db)
    check_user_is_participant(trip_id, current_user.id, db)
    
    # Get routes with vote counts
    routes = db.query(
        RouteOption,
        func.count(Vote.id).label('vote_count')
    ).outerjoin(
        Vote, Vote.route_option_id == RouteOption.id
    ).filter(
        RouteOption.trip_id == trip_id
    ).group_by(
        RouteOption.id
    ).order_by(
        RouteOption.option_number
    ).all()
    
    return [
        RouteOptionResponse(
            id=route.id,
            trip_id=route.trip_id,
            option_number=route.option_number,
            title=route.title,
            description=route.description,
            reasoning=route.reasoning,
            created_at=route.created_at,
            vote_count=vote_count,
        )
        for route, vote_count in routes
    ]


@router.get("/{trip_id}/routes/{route_id}/why-not-included")
async def get_why_not_included(
    trip_id: int,
    route_id: int,
    preference_id: int = Query(..., description="ID пожелания (места)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a short AI explanation of why a place (preference) was not included in this route."""
    get_trip_or_404(trip_id, db)
    check_user_is_participant(trip_id, current_user.id, db)
    route = db.query(RouteOption).filter(
        RouteOption.id == route_id,
        RouteOption.trip_id == trip_id,
    ).first()
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    pref = db.query(PlacePreference).filter(
        PlacePreference.id == preference_id,
        PlacePreference.trip_id == trip_id,
    ).first()
    if not pref:
        raise HTTPException(status_code=404, detail="Пожелание не найдено")
    place_name = (pref.location or "").strip() or f"{pref.city}"
    try:
        reason = await explain_why_not_included(
            route_title=route.title,
            route_description=route.description or "",
            place_name=place_name,
            country=pref.country or "",
            city=pref.city or "",
            priority=pref.priority or 3,
            comment=pref.comment,
        )
        return {"reason": reason}
    except Exception as e:
        err = str(e).lower()
        if "429" in err or "лимит" in err:
            raise HTTPException(status_code=429, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{trip_id}/generate-routes", response_model=GenerateRoutesResponse)
async def generate_trip_routes(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate route options using LLM. Requires at least 1 preference."""
    trip = get_trip_or_404(trip_id, db)
    check_user_is_participant(trip_id, current_user.id, db)
    
    # Check generation limit
    if trip.generation_count >= settings.max_generation_count:
        raise HTTPException(
            status_code=400,
            detail=f"Максимум {settings.max_generation_count} генераций на поездку"
        )
    
    # Check if generation is already in progress
    if trip.generation_status == GenerationStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Генерация маршрутов уже выполняется"
        )
    
    # Get preferences with user data
    preferences = db.query(PlacePreference).options(
        joinedload(PlacePreference.user)
    ).filter(
        PlacePreference.trip_id == trip_id
    ).all()
    
    if not preferences:
        raise HTTPException(
            status_code=400,
            detail="Добавьте хотя бы одно пожелание для генерации маршрутов"
        )
    
    # Update trip status
    trip.generation_status = GenerationStatus.IN_PROGRESS
    db.commit()
    
    try:
        # Generate routes using LLM
        route_data = await generate_routes(trip, preferences)
        
        # Delete old routes and votes
        db.query(RouteOption).filter(RouteOption.trip_id == trip_id).delete()
        
        # Save new routes
        new_routes = []
        for i, data in enumerate(route_data, 1):
            route = RouteOption(
                trip_id=trip_id,
                option_number=i,
                title=data["title"],
                description=data["description"],
                reasoning=data.get("reasoning"),
            )
            db.add(route)
            new_routes.append(route)
        
        # Update trip status
        trip.generation_status = GenerationStatus.COMPLETED
        trip.generation_count += 1
        db.commit()
        
        # Refresh to get IDs
        for route in new_routes:
            db.refresh(route)
        
        return GenerateRoutesResponse(
            status="success",
            message=f"Сгенерировано {len(new_routes)} вариантов маршрута",
            routes=[
                RouteOptionResponse(
                    id=r.id,
                    trip_id=r.trip_id,
                    option_number=r.option_number,
                    title=r.title,
                    description=r.description,
                    reasoning=r.reasoning,
                    created_at=r.created_at,
                    vote_count=0,
                )
                for r in new_routes
            ]
        )
        
    except Exception as e:
        trip.generation_status = GenerationStatus.FAILED
        db.commit()
        
        # Handle DeepSeek API errors
        error_str = str(e)
        if "insufficient_quota" in error_str or "429" in error_str:
            raise HTTPException(
                status_code=429,
                detail="Превышен лимит использования DeepSeek API. Пожалуйста, проверьте баланс и настройки API ключа."
            )
        elif "rate_limit" in error_str.lower() or "rate limit" in error_str.lower():
            raise HTTPException(
                status_code=429,
                detail="Превышен лимит запросов к DeepSeek API. Пожалуйста, подождите немного и попробуйте снова."
            )
        elif "invalid_api_key" in error_str.lower() or "authentication" in error_str.lower():
            raise HTTPException(
                status_code=500,
                detail="Ошибка аутентификации DeepSeek API. Пожалуйста, проверьте настройки API ключа."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Ошибка генерации маршрутов: {str(e)}"
            )
