from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.database import get_db
from app.models import User, Trip, TripParticipant, RouteOption, Vote, GenerationStatus, ParticipantRole
from app.utils.deps import get_current_user

router = APIRouter()


class VoteRequest(BaseModel):
    route_option_id: int


class VoteResponse(BaseModel):
    id: int
    user_id: int
    route_option_id: int


class MyVotesResponse(BaseModel):
    route_option_ids: List[int]


class VotingResultItem(BaseModel):
    route_option_id: int
    title: str
    vote_count: int


class VotingResultsResponse(BaseModel):
    results: List[VotingResultItem]
    is_finished: bool
    winner_id: int | None = None


def get_trip_or_404(trip_id: int, db: Session) -> Trip:
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


def check_user_is_participant(trip_id: int, user_id: int, db: Session):
    participant = db.query(TripParticipant).filter(
        TripParticipant.trip_id == trip_id,
        TripParticipant.user_id == user_id
    ).first()
    if not participant:
        raise HTTPException(status_code=403, detail="You are not a participant of this trip")
    return participant


@router.post("/{trip_id}/votes", response_model=VoteResponse, status_code=status.HTTP_201_CREATED)
def vote_for_route(
    trip_id: int,
    vote_data: VoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Vote for a route option. Users can vote for multiple options."""
    trip = get_trip_or_404(trip_id, db)
    check_user_is_participant(trip_id, current_user.id, db)
    
    # Check if routes exist
    if trip.generation_status != GenerationStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Routes have not been generated yet")
    
    # Verify route belongs to this trip
    route = db.query(RouteOption).filter(
        RouteOption.id == vote_data.route_option_id,
        RouteOption.trip_id == trip_id
    ).first()
    
    if not route:
        raise HTTPException(status_code=404, detail="Route option not found")
    
    # Check if already voted for this option
    existing = db.query(Vote).filter(
        Vote.user_id == current_user.id,
        Vote.route_option_id == vote_data.route_option_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="You already voted for this option")
    
    # Create vote
    vote = Vote(
        trip_id=trip_id,
        user_id=current_user.id,
        route_option_id=vote_data.route_option_id
    )
    db.add(vote)
    db.commit()
    db.refresh(vote)
    
    return VoteResponse(
        id=vote.id,
        user_id=vote.user_id,
        route_option_id=vote.route_option_id
    )


@router.delete("/{trip_id}/votes/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_vote(
    trip_id: int,
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a vote from a route option."""
    get_trip_or_404(trip_id, db)
    check_user_is_participant(trip_id, current_user.id, db)
    
    vote = db.query(Vote).filter(
        Vote.user_id == current_user.id,
        Vote.route_option_id == route_id
    ).first()
    
    if not vote:
        raise HTTPException(status_code=404, detail="Vote not found")
    
    db.delete(vote)
    db.commit()


@router.get("/{trip_id}/my-votes", response_model=MyVotesResponse)
def get_my_votes(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's votes for this trip."""
    get_trip_or_404(trip_id, db)
    check_user_is_participant(trip_id, current_user.id, db)
    
    votes = db.query(Vote.route_option_id).filter(
        Vote.trip_id == trip_id,
        Vote.user_id == current_user.id
    ).all()
    
    return MyVotesResponse(route_option_ids=[v[0] for v in votes])


@router.get("/{trip_id}/voting-results", response_model=VotingResultsResponse)
def get_voting_results(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get voting results for all route options."""
    trip = get_trip_or_404(trip_id, db)
    check_user_is_participant(trip_id, current_user.id, db)
    
    results = db.query(
        RouteOption.id,
        RouteOption.title,
        func.count(Vote.id).label('vote_count')
    ).outerjoin(
        Vote, Vote.route_option_id == RouteOption.id
    ).filter(
        RouteOption.trip_id == trip_id
    ).group_by(
        RouteOption.id
    ).order_by(
        func.count(Vote.id).desc()
    ).all()
    
    result_items = [
        VotingResultItem(
            route_option_id=r[0],
            title=r[1],
            vote_count=r[2]
        )
        for r in results
    ]
    
    winner_id = result_items[0].route_option_id if result_items and result_items[0].vote_count > 0 else None
    
    return VotingResultsResponse(
        results=result_items,
        is_finished=False,  # Can add finish logic later
        winner_id=winner_id
    )
