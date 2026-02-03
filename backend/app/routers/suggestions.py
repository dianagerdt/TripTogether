from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.llm_service import suggest_places
from app.utils.deps import get_current_user
from app.models import User, TripParticipant, PlacePreference

router = APIRouter()


def _get_exclude_names(trip_id: int, country: str, city: str, db: Session) -> list[str]:
    """Names of places already in trip preferences for this country+city (to avoid duplicates)."""
    prefs = (
        db.query(PlacePreference.location)
        .filter(
            PlacePreference.trip_id == trip_id,
            PlacePreference.country == country.strip(),
            PlacePreference.city == city.strip(),
            PlacePreference.location.isnot(None),
            PlacePreference.location != "",
        )
        .all()
    )
    return list({(p[0] or "").strip() for p in prefs if (p[0] or "").strip()})


@router.get("/suggestions/places")
async def get_place_suggestions(
    country: str = Query(..., min_length=1),
    city: str = Query(..., min_length=1),
    trip_id: int | None = Query(None, description="If set, exclude places already in trip preferences for this country+city"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get AI suggestions for places to visit in a given country and city."""
    exclude_names: list[str] = []
    if trip_id is not None:
        participant = db.query(TripParticipant).filter(
            TripParticipant.trip_id == trip_id,
            TripParticipant.user_id == current_user.id,
        ).first()
        if participant:
            exclude_names = _get_exclude_names(trip_id, country, city, db)
    try:
        suggestions = await suggest_places(country=country, city=city, exclude_names=exclude_names or None)
        return {"suggestions": suggestions}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        err = str(e).lower()
        if "rate limit" in err or "429" in err:
            raise HTTPException(status_code=429, detail="Превышен лимит запросов. Попробуйте позже.")
        if "api key" in err or "invalid" in err:
            raise HTTPException(status_code=503, detail="Сервис подсказок временно недоступен.")
        raise HTTPException(status_code=500, detail="Не удалось получить подсказки.")
