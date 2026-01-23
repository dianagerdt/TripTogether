from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, Integer, case
from app.database import get_db
from app.models import User, Trip, TripParticipant, ParticipantRole
from app.schemas.trip import (
    TripCreate,
    TripUpdate,
    TripResponse,
    TripDetailResponse,
    TripListResponse,
    ParticipantResponse,
    JoinTripRequest,
)
from app.utils.deps import get_current_user
from app.config import settings

router = APIRouter()


def get_trip_or_404(trip_id: int, db: Session) -> Trip:
    """Get trip by ID or raise 404."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Поездка не найдена")
    return trip


def check_user_is_participant(trip: Trip, user: User, db: Session) -> TripParticipant:
    """Check if user is a participant of the trip."""
    participant = db.query(TripParticipant).filter(
        TripParticipant.trip_id == trip.id,
        TripParticipant.user_id == user.id
    ).first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Вы не являетесь участником этой поездки")
    
    return participant


def check_user_is_organizer(trip: Trip, user: User, db: Session):
    """Check if user is the organizer of the trip."""
    participant = check_user_is_participant(trip, user, db)
    if participant.role != ParticipantRole.ORGANIZER:
        raise HTTPException(status_code=403, detail="Только организатор может выполнить это действие")


@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
def create_trip(
    trip_data: TripCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new trip. The creator becomes the organizer."""
    # Create trip
    trip = Trip(
        title=trip_data.title,
        description=trip_data.description,
        start_date=trip_data.start_date,
        end_date=trip_data.end_date,
        created_by_id=current_user.id,
    )
    db.add(trip)
    db.flush()  # Get trip.id
    
    # Add creator as organizer
    participant = TripParticipant(
        trip_id=trip.id,
        user_id=current_user.id,
        role=ParticipantRole.ORGANIZER,
    )
    db.add(participant)
    db.commit()
    db.refresh(trip)
    
    return trip


@router.get("", response_model=List[TripListResponse])
def get_my_trips(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all trips where the current user is a participant."""
    # Get trips where user is participant
    user_trips = (
        db.query(TripParticipant.trip_id, TripParticipant.role)
        .filter(TripParticipant.user_id == current_user.id)
        .subquery()
    )
    
    trips_with_counts = (
        db.query(
            Trip,
            func.count(TripParticipant.id).label('participant_count'),
            user_trips.c.role
        )
        .join(user_trips, Trip.id == user_trips.c.trip_id)
        .join(TripParticipant, Trip.id == TripParticipant.trip_id)
        .group_by(Trip.id, user_trips.c.role)
        .order_by(Trip.start_date.desc())
        .all()
    )
    
    result = []
    for trip, participant_count, role in trips_with_counts:
        result.append(TripListResponse(
            id=trip.id,
            title=trip.title,
            description=trip.description,
            start_date=trip.start_date,
            end_date=trip.end_date,
            generation_status=trip.generation_status,
            participant_count=participant_count,
            is_organizer=(role == ParticipantRole.ORGANIZER),
        ))
    
    return result


@router.get("/{trip_id}", response_model=TripDetailResponse)
def get_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get trip details. Only participants can view."""
    trip = db.query(Trip).options(
        joinedload(Trip.participants).joinedload(TripParticipant.user)
    ).filter(Trip.id == trip_id).first()
    
    if not trip:
        raise HTTPException(status_code=404, detail="Поездка не найдена")
    
    check_user_is_participant(trip, current_user, db)
    
    # Build participants response
    participants = []
    for p in trip.participants:
        participants.append(ParticipantResponse(
            id=p.id,
            user_id=p.user_id,
            username=p.user.username,
            role=p.role,
            joined_at=p.joined_at,
        ))
    
    return TripDetailResponse(
        id=trip.id,
        title=trip.title,
        description=trip.description,
        start_date=trip.start_date,
        end_date=trip.end_date,
        invite_code=trip.invite_code,
        generation_status=trip.generation_status,
        generation_count=trip.generation_count,
        created_by_id=trip.created_by_id,
        created_at=trip.created_at,
        participants=participants,
    )


@router.patch("/{trip_id}", response_model=TripResponse)
def update_trip(
    trip_id: int,
    trip_data: TripUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update trip. Only the organizer can update."""
    trip = get_trip_or_404(trip_id, db)
    check_user_is_organizer(trip, current_user, db)
    
    update_data = trip_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trip, field, value)
    
    db.commit()
    db.refresh(trip)
    return trip


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete trip. Only the organizer can delete."""
    trip = get_trip_or_404(trip_id, db)
    check_user_is_organizer(trip, current_user, db)
    
    db.delete(trip)
    db.commit()


# --- Invite / Join / Leave ---

@router.post("/join", response_model=TripResponse)
def join_trip(
    request: JoinTripRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Join a trip using invite code."""
    trip = db.query(Trip).filter(Trip.invite_code == request.invite_code).first()
    
    if not trip:
        raise HTTPException(status_code=404, detail="Недействительный код приглашения")
    
    # Check if already a participant
    existing = db.query(TripParticipant).filter(
        TripParticipant.trip_id == trip.id,
        TripParticipant.user_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Вы уже являетесь участником этой поездки")
    
    # Check participant limit
    participant_count = db.query(TripParticipant).filter(
        TripParticipant.trip_id == trip.id
    ).count()
    
    if participant_count >= settings.max_participants_per_trip:
        raise HTTPException(status_code=400, detail="Достигнуто максимальное количество участников")
    
    # Add as participant
    participant = TripParticipant(
        trip_id=trip.id,
        user_id=current_user.id,
        role=ParticipantRole.PARTICIPANT,
    )
    db.add(participant)
    db.commit()
    db.refresh(trip)
    
    return trip


@router.post("/{trip_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Leave a trip. Organizer cannot leave."""
    trip = get_trip_or_404(trip_id, db)
    participant = check_user_is_participant(trip, current_user, db)
    
    if participant.role == ParticipantRole.ORGANIZER:
        raise HTTPException(
            status_code=400, 
            detail="Организатор не может покинуть поездку. Удалите поездку."
        )
    
    db.delete(participant)
    db.commit()


@router.get("/{trip_id}/participants", response_model=List[ParticipantResponse])
def get_participants(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all participants of a trip."""
    trip = get_trip_or_404(trip_id, db)
    check_user_is_participant(trip, current_user, db)
    
    participants = db.query(TripParticipant).options(
        joinedload(TripParticipant.user)
    ).filter(TripParticipant.trip_id == trip_id).all()
    
    return [
        ParticipantResponse(
            id=p.id,
            user_id=p.user_id,
            username=p.user.username,
            role=p.role,
            joined_at=p.joined_at,
        )
        for p in participants
    ]
