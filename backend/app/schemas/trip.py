from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
from app.models.trip import GenerationStatus, ParticipantRole


# --- Participant schemas ---
class ParticipantResponse(BaseModel):
    id: int
    user_id: int
    username: str
    role: ParticipantRole
    joined_at: datetime

    class Config:
        from_attributes = True


# --- Trip schemas ---
class TripBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: date
    end_date: date
    
    @field_validator('end_date')
    @classmethod
    def end_date_must_be_after_start(cls, v, info):
        if 'start_date' in info.data and v < info.data['start_date']:
            raise ValueError('end_date must be >= start_date')
        return v
    
    @field_validator('start_date')
    @classmethod
    def start_date_not_in_past(cls, v):
        if v < date.today():
            raise ValueError('start_date cannot be in the past')
        return v


class TripCreate(TripBase):
    pass


class TripUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class TripResponse(TripBase):
    id: int
    invite_code: str
    generation_status: GenerationStatus
    generation_count: int
    created_by_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TripDetailResponse(TripResponse):
    participants: List[ParticipantResponse] = []
    max_generation_count: int
    
    class Config:
        from_attributes = True


class TripListResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    start_date: date
    end_date: date
    generation_status: GenerationStatus
    participant_count: int
    is_organizer: bool

    class Config:
        from_attributes = True


# --- Invite schemas ---
class JoinTripRequest(BaseModel):
    invite_code: str
