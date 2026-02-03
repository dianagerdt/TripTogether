import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import User, Trip, TripParticipant, RouteOption, Vote, TripChecklist, PlacePreference
from app.schemas.checklist import ChecklistResponse
from app.services.llm_service import generate_packing_list
from app.utils.deps import get_current_user

router = APIRouter()


def get_trip_or_404(trip_id: int, db: Session) -> Trip:
    t = db.query(Trip).filter(Trip.id == trip_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Поездка не найдена")
    return t


def check_participant(trip_id: int, user_id: int, db: Session) -> TripParticipant:
    p = db.query(TripParticipant).filter(
        TripParticipant.trip_id == trip_id,
        TripParticipant.user_id == user_id,
    ).first()
    if not p:
        raise HTTPException(status_code=403, detail="Вы не являетесь участником этой поездки")
    return p


@router.get("/{trip_id}/checklist", response_model=ChecklistResponse | None)
def get_checklist(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get packing checklist for the trip. All participants can view. None if not generated yet."""
    get_trip_or_404(trip_id, db)
    check_participant(trip_id, current_user.id, db)
    checklist = db.query(TripChecklist).filter(TripChecklist.trip_id == trip_id).first()
    if not checklist:
        return None
    # Ensure content is a dict (SQLite/some drivers may return JSON as str)
    raw = checklist.content
    if isinstance(raw, str):
        try:
            content = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            content = {}
    else:
        content = raw if isinstance(raw, dict) else {}
    return ChecklistResponse(
        id=checklist.id,
        trip_id=checklist.trip_id,
        created_by_id=checklist.created_by_id,
        created_at=checklist.created_at,
        content=content,
    )


@router.post("/{trip_id}/generate-checklist", response_model=ChecklistResponse, status_code=status.HTTP_201_CREATED)
async def generate_checklist(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate packing checklist from the winning route (most votes). Any participant can generate."""
    try:
        return await _do_generate_checklist(trip_id, db, current_user)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации чек-листа: {str(e)}")


async def _do_generate_checklist(trip_id: int, db: Session, current_user: User):
    trip = get_trip_or_404(trip_id, db)
    check_participant(trip_id, current_user.id, db)

    # Get route with most votes (winner); must have at least one vote
    # Row order: id, title, description, votes (access by index for compatibility)
    winner_row = (
        db.query(RouteOption.id, RouteOption.title, RouteOption.description, func.count(Vote.id).label("votes"))
        .outerjoin(Vote, Vote.route_option_id == RouteOption.id)
        .filter(RouteOption.trip_id == trip_id)
        .group_by(RouteOption.id)
        .order_by(func.count(Vote.id).desc())
        .first()
    )
    if not winner_row:
        raise HTTPException(
            status_code=400,
            detail="Сначала сгенерируйте маршруты. Чек-лист строится по маршруту, набравшему больше всего голосов.",
        )
    winner_id, winner_title, winner_description, winner_votes = winner_row[0], winner_row[1], winner_row[2], winner_row[3]
    if not winner_title:
        raise HTTPException(
            status_code=400,
            detail="Сначала сгенерируйте маршруты. Чек-лист строится по маршруту, набравшему больше всего голосов.",
        )
    if (winner_votes or 0) == 0:
        raise HTTPException(
            status_code=400,
            detail="Сначала проголосуйте за маршрут. Чек-лист строится по варианту, набравшему большинство голосов.",
        )

    # Countries/cities from trip preferences (маршрут строился по этим пожеланиям)
    prefs = (
        db.query(PlacePreference.country, PlacePreference.city)
        .filter(PlacePreference.trip_id == trip_id)
        .distinct()
        .all()
    )
    places_parts = []
    by_country: dict[str, list[str]] = {}
    for country, city in prefs:
        country = (country or "").strip()
        city = (city or "").strip()
        if not country:
            continue
        by_country.setdefault(country, [])
        if city and city not in by_country[country]:
            by_country[country].append(city)
    for country, cities in sorted(by_country.items()):
        if cities:
            places_parts.append(f"{country} ({', '.join(sorted(cities))})")
        else:
            places_parts.append(country)
    places_from_route = "; ".join(places_parts) if places_parts else None

    try:
        content = await generate_packing_list(
            trip=trip,
            winner_route_title=winner_title,
            winner_route_description=winner_description or "",
            places_from_route=places_from_route,
        )
    except Exception as e:
        msg = str(e)
        if "лимит" in msg or "429" in msg:
            raise HTTPException(status_code=429, detail=msg)
        raise HTTPException(status_code=500, detail=msg)

    # Upsert: remove old checklist for this trip, add new
    db.query(TripChecklist).filter(TripChecklist.trip_id == trip_id).delete()
    checklist = TripChecklist(
        trip_id=trip_id,
        created_by_id=current_user.id,
        content=content,
    )
    db.add(checklist)
    db.commit()
    db.refresh(checklist)
    return checklist
