from datetime import datetime
from typing import List, Any, Optional
from pydantic import BaseModel


class ChecklistCategory(BaseModel):
    name: str
    items: List[str]


class ChecklistContent(BaseModel):
    categories: List[ChecklistCategory]


class ChecklistResponse(BaseModel):
    id: int
    trip_id: int
    created_by_id: Optional[int]
    created_at: datetime
    content: dict  # { "categories": [ { "name": "...", "items": [...] }, ... ] }

    class Config:
        from_attributes = True
