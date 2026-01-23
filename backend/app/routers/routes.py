from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.models import User, Trip, TripParticipant, PlacePreference, RouteOption, Vote, GenerationStatus, ParticipantRole
from app.schemas.route import RouteOptionResponse, GenerateRoutesResponse
from app.services.llm_service import generate_routes
from app.utils.deps import get_current_user
from app.config import settings
import asyncio

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
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка генерации маршрутов: {str(e)}"
        )
