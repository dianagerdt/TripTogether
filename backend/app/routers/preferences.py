from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import User, Trip, TripParticipant, PlacePreference
from app.schemas.preference import (
    PreferenceCreate,
    PreferenceUpdate,
    PreferenceResponse,
    DuplicateWarning,
)
from app.utils.deps import get_current_user
from app.config import settings

router = APIRouter()

# Initialize geocoder only if API key is configured
try:
    from app.services.yandex_geocoder import YandexGeocoder
    geocoder = YandexGeocoder() if settings.yandex_api_key else None
except (ValueError, ImportError):
    geocoder = None


def get_trip_or_404(trip_id: int, db: Session) -> Trip:
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Поездка не найдена")
    return trip


def check_user_is_participant(trip_id: int, user_id: int, db: Session):
    participant = db.query(TripParticipant).filter(
        TripParticipant.trip_id == trip_id,
        TripParticipant.user_id == user_id
    ).first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Вы не являетесь участником этой поездки")


def check_duplicate_preference(
    trip_id: int, 
    country: str, 
    city: str, 
    location: str | None,
    exclude_id: int | None = None,
    db: Session = None
) -> DuplicateWarning:
    """Check if a similar preference already exists."""
    query = db.query(PlacePreference).filter(
        PlacePreference.trip_id == trip_id,
        PlacePreference.country.ilike(country),
        PlacePreference.city.ilike(city),
    )
    
    if location:
        query = query.filter(PlacePreference.location.ilike(location))
    
    if exclude_id:
        query = query.filter(PlacePreference.id != exclude_id)
    
    existing = query.first()
    
    if existing:
        return DuplicateWarning(
            is_duplicate=True,
            existing_preference_id=existing.id,
            message=f"Похожее место уже добавлено пользователем. Возможно, стоит повысить приоритет существующего?"
        )
    
    return DuplicateWarning(is_duplicate=False)


@router.get("/{trip_id}/preferences", response_model=List[PreferenceResponse])
def get_preferences(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all preferences for a trip. All participants can view."""
    get_trip_or_404(trip_id, db)
    check_user_is_participant(trip_id, current_user.id, db)
    
    preferences = db.query(PlacePreference).options(
        joinedload(PlacePreference.user)
    ).filter(
        PlacePreference.trip_id == trip_id
    ).order_by(
        PlacePreference.priority.desc(),
        PlacePreference.created_at.desc()
    ).all()
    
    return [
        PreferenceResponse(
            id=p.id,
            trip_id=p.trip_id,
            user_id=p.user_id,
            username=p.user.username,
            country=p.country,
            city=p.city,
            location=p.location,
            place_type=p.place_type,
            priority=p.priority,
            comment=p.comment,
            latitude=float(p.latitude) if p.latitude else None,
            longitude=float(p.longitude) if p.longitude else None,
            yandex_place_id=p.yandex_place_id,
            created_at=p.created_at,
        )
        for p in preferences
    ]


@router.post("/{trip_id}/preferences", response_model=PreferenceResponse, status_code=status.HTTP_201_CREATED)
def create_preference(
    trip_id: int,
    pref_data: PreferenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a new preference to a trip."""
    trip = get_trip_or_404(trip_id, db)
    check_user_is_participant(trip_id, current_user.id, db)
    
    # Check preference limit
    pref_count = db.query(PlacePreference).filter(
        PlacePreference.trip_id == trip_id
    ).count()
    
    if pref_count >= settings.max_preferences_per_trip:
        raise HTTPException(
            status_code=400, 
            detail=f"Максимум {settings.max_preferences_per_trip} пожеланий на поездку"
        )
    
    # Create preference
    preference = PlacePreference(
        trip_id=trip_id,
        user_id=current_user.id,
        country=pref_data.country,
        city=pref_data.city,
        location=pref_data.location,
        place_type=pref_data.place_type,
        priority=pref_data.priority,
        comment=pref_data.comment,
    )
    
    # Try to geocode the address
    if geocoder:
        try:
            geocode_result = geocoder.geocode_preference(
                pref_data.country,
                pref_data.city,
                pref_data.location
            )
            if geocode_result:
                preference.latitude = geocode_result["latitude"]
                preference.longitude = geocode_result["longitude"]
                preference.yandex_place_id = geocode_result.get("place_id")
        except Exception as e:
            # Не падаем, если геокодирование не удалось
            print(f"Geocoding failed: {str(e)}")
    
    db.add(preference)
    db.commit()
    db.refresh(preference)
    
    return PreferenceResponse(
        id=preference.id,
        trip_id=preference.trip_id,
        user_id=preference.user_id,
        username=current_user.username,
        country=preference.country,
        city=preference.city,
        location=preference.location,
        place_type=preference.place_type,
        priority=preference.priority,
        comment=preference.comment,
        latitude=float(preference.latitude) if preference.latitude else None,
        longitude=float(preference.longitude) if preference.longitude else None,
        yandex_place_id=preference.yandex_place_id,
        created_at=preference.created_at,
    )


@router.post("/{trip_id}/preferences/check-duplicate", response_model=DuplicateWarning)
def check_preference_duplicate(
    trip_id: int,
    pref_data: PreferenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if a similar preference already exists (soft-merge warning)."""
    get_trip_or_404(trip_id, db)
    check_user_is_participant(trip_id, current_user.id, db)
    
    return check_duplicate_preference(
        trip_id=trip_id,
        country=pref_data.country,
        city=pref_data.city,
        location=pref_data.location,
        db=db
    )


@router.patch("/{trip_id}/preferences/{pref_id}", response_model=PreferenceResponse)
def update_preference(
    trip_id: int,
    pref_id: int,
    pref_data: PreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a preference. Only the owner can update."""
    get_trip_or_404(trip_id, db)
    
    preference = db.query(PlacePreference).filter(
        PlacePreference.id == pref_id,
        PlacePreference.trip_id == trip_id
    ).first()
    
    if not preference:
        raise HTTPException(status_code=404, detail="Пожелание не найдено")
    
    if preference.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Вы можете редактировать только свои пожелания")
    
    update_data = pref_data.model_dump(exclude_unset=True)
    
    # Check if address fields changed - need to re-geocode
    address_changed = any(field in update_data for field in ['country', 'city', 'location'])
    
    for field, value in update_data.items():
        setattr(preference, field, value)
    
    # Re-geocode if address changed
    if address_changed and geocoder:
        try:
            geocode_result = geocoder.geocode_preference(
                preference.country,
                preference.city,
                preference.location
            )
            if geocode_result:
                preference.latitude = geocode_result["latitude"]
                preference.longitude = geocode_result["longitude"]
                preference.yandex_place_id = geocode_result.get("place_id")
            else:
                # Clear coordinates if geocoding failed
                preference.latitude = None
                preference.longitude = None
                preference.yandex_place_id = None
        except Exception as e:
            print(f"Geocoding failed during update: {str(e)}")
    
    db.commit()
    db.refresh(preference)
    
    return PreferenceResponse(
        id=preference.id,
        trip_id=preference.trip_id,
        user_id=preference.user_id,
        username=current_user.username,
        country=preference.country,
        city=preference.city,
        location=preference.location,
        place_type=preference.place_type,
        priority=preference.priority,
        comment=preference.comment,
        latitude=float(preference.latitude) if preference.latitude else None,
        longitude=float(preference.longitude) if preference.longitude else None,
        yandex_place_id=preference.yandex_place_id,
        created_at=preference.created_at,
    )


@router.post("/{trip_id}/preferences/{pref_id}/geocode", response_model=PreferenceResponse)
def geocode_preference(
    trip_id: int,
    pref_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Геокодировать пожелание (получить координаты)."""
    get_trip_or_404(trip_id, db)
    check_user_is_participant(trip_id, current_user.id, db)
    
    preference = db.query(PlacePreference).options(
        joinedload(PlacePreference.user)
    ).filter(
        PlacePreference.id == pref_id,
        PlacePreference.trip_id == trip_id
    ).first()
    
    if not preference:
        raise HTTPException(status_code=404, detail="Пожелание не найдено")
    
    if not geocoder:
        raise HTTPException(status_code=503, detail="Геокодирование недоступно (не настроен API ключ)")
    
    # Geocode the address
    try:
        geocode_result = geocoder.geocode_preference(
            preference.country,
            preference.city,
            preference.location
        )
        
        if geocode_result:
            preference.latitude = geocode_result["latitude"]
            preference.longitude = geocode_result["longitude"]
            preference.yandex_place_id = geocode_result.get("place_id")
            db.commit()
            db.refresh(preference)
        else:
            raise HTTPException(status_code=404, detail="Не удалось найти координаты для этого адреса")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка геокодирования: {str(e)}")
    
    return PreferenceResponse(
        id=preference.id,
        trip_id=preference.trip_id,
        user_id=preference.user_id,
        username=preference.user.username,
        country=preference.country,
        city=preference.city,
        location=preference.location,
        place_type=preference.place_type,
        priority=preference.priority,
        comment=preference.comment,
        latitude=float(preference.latitude) if preference.latitude else None,
        longitude=float(preference.longitude) if preference.longitude else None,
        yandex_place_id=preference.yandex_place_id,
        created_at=preference.created_at,
    )


@router.delete("/{trip_id}/preferences/{pref_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_preference(
    trip_id: int,
    pref_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a preference. Only the owner can delete."""
    get_trip_or_404(trip_id, db)
    
    preference = db.query(PlacePreference).filter(
        PlacePreference.id == pref_id,
        PlacePreference.trip_id == trip_id
    ).first()
    
    if not preference:
        raise HTTPException(status_code=404, detail="Пожелание не найдено")
    
    if preference.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Вы можете удалять только свои пожелания")
    
    db.delete(preference)
    db.commit()
