from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.preference import PlaceType


class PreferenceBase(BaseModel):
    country: str = Field(..., min_length=1, max_length=100)
    city: str = Field(..., min_length=1, max_length=100)
    location: Optional[str] = Field(None, max_length=255)
    place_type: PlaceType = PlaceType.OTHER
    priority: int = Field(default=3, ge=1, le=5)
    comment: Optional[str] = None


class PreferenceCreate(PreferenceBase):
    pass


class PreferenceUpdate(BaseModel):
    country: Optional[str] = Field(None, min_length=1, max_length=100)
    city: Optional[str] = Field(None, min_length=1, max_length=100)
    location: Optional[str] = Field(None, max_length=255)
    place_type: Optional[PlaceType] = None
    priority: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = None


class PreferenceResponse(PreferenceBase):
    id: int
    trip_id: int
    user_id: int
    username: str  # Added for display
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    yandex_place_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DuplicateWarning(BaseModel):
    is_duplicate: bool
    existing_preference_id: Optional[int] = None
    message: Optional[str] = None
