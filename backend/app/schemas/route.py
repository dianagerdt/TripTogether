from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class RouteOptionBase(BaseModel):
    title: str
    description: str
    reasoning: Optional[str] = None


class RouteOptionResponse(RouteOptionBase):
    id: int
    trip_id: int
    option_number: int
    created_at: datetime
    vote_count: int = 0

    class Config:
        from_attributes = True


class GenerateRoutesResponse(BaseModel):
    status: str
    message: str
    routes: List[RouteOptionResponse] = []
