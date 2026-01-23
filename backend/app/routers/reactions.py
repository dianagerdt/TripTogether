from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.database import get_db
from app.models import User, Trip, TripParticipant, PlacePreference, Reaction
from app.utils.deps import get_current_user

router = APIRouter()

# Available emoji reactions
AVAILABLE_EMOJIS = ["👍", "❤️", "🔥", "🤩", "🙏", "😍"]


class ReactionCreate(BaseModel):
    emoji: str


class ReactionResponse(BaseModel):
    emoji: str
    count: int
    users: List[str]
    user_reacted: bool


class PreferenceReactionsResponse(BaseModel):
    preference_id: int
    reactions: List[ReactionResponse]


def check_user_is_participant(trip_id: int, user_id: int, db: Session):
    participant = db.query(TripParticipant).filter(
        TripParticipant.trip_id == trip_id,
        TripParticipant.user_id == user_id
    ).first()
    if not participant:
        raise HTTPException(status_code=403, detail="Вы не являетесь участником этой поездки")


@router.post("/{preference_id}/reactions", status_code=status.HTTP_201_CREATED)
def add_reaction(
    preference_id: int,
    reaction_data: ReactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add or update reaction to a preference."""
    # Validate emoji
    if reaction_data.emoji not in AVAILABLE_EMOJIS:
        raise HTTPException(status_code=400, detail=f"Недопустимый emoji. Доступные: {', '.join(AVAILABLE_EMOJIS)}")
    
    # Get preference and check access
    preference = db.query(PlacePreference).filter(PlacePreference.id == preference_id).first()
    if not preference:
        raise HTTPException(status_code=404, detail="Пожелание не найдено")
    
    check_user_is_participant(preference.trip_id, current_user.id, db)
    
    # Check if user already has a reaction
    existing = db.query(Reaction).filter(
        Reaction.preference_id == preference_id,
        Reaction.user_id == current_user.id
    ).first()
    
    if existing:
        # Update existing reaction
        existing.emoji = reaction_data.emoji
        db.commit()
        return {"message": "Реакция обновлена"}
    
    # Create new reaction
    reaction = Reaction(
        preference_id=preference_id,
        user_id=current_user.id,
        emoji=reaction_data.emoji
    )
    db.add(reaction)
    db.commit()
    
    return {"message": "Реакция добавлена"}


@router.delete("/{preference_id}/reactions", status_code=status.HTTP_204_NO_CONTENT)
def remove_reaction(
    preference_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove user's reaction from a preference."""
    preference = db.query(PlacePreference).filter(PlacePreference.id == preference_id).first()
    if not preference:
        raise HTTPException(status_code=404, detail="Пожелание не найдено")
    
    check_user_is_participant(preference.trip_id, current_user.id, db)
    
    reaction = db.query(Reaction).filter(
        Reaction.preference_id == preference_id,
        Reaction.user_id == current_user.id
    ).first()
    
    if reaction:
        db.delete(reaction)
        db.commit()


@router.get("/trips/{trip_id}/reactions", response_model=List[PreferenceReactionsResponse])
def get_trip_reactions(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all reactions for all preferences in a trip."""
    check_user_is_participant(trip_id, current_user.id, db)
    
    # Get all preference IDs for this trip
    preferences = db.query(PlacePreference.id).filter(PlacePreference.trip_id == trip_id).all()
    pref_ids = [p.id for p in preferences]
    
    if not pref_ids:
        return []
    
    # Get all reactions for these preferences
    reactions = db.query(Reaction).join(User).filter(
        Reaction.preference_id.in_(pref_ids)
    ).all()
    
    # Group reactions by preference_id and emoji
    result = {}
    for pref_id in pref_ids:
        result[pref_id] = {}
    
    for r in reactions:
        if r.emoji not in result[r.preference_id]:
            result[r.preference_id][r.emoji] = {
                'count': 0,
                'users': [],
                'user_reacted': False
            }
        result[r.preference_id][r.emoji]['count'] += 1
        result[r.preference_id][r.emoji]['users'].append(r.user.username)
        if r.user_id == current_user.id:
            result[r.preference_id][r.emoji]['user_reacted'] = True
    
    # Format response
    response = []
    for pref_id, emojis in result.items():
        reactions_list = [
            ReactionResponse(
                emoji=emoji,
                count=data['count'],
                users=data['users'],
                user_reacted=data['user_reacted']
            )
            for emoji, data in emojis.items()
        ]
        response.append(PreferenceReactionsResponse(
            preference_id=pref_id,
            reactions=reactions_list
        ))
    
    return response
