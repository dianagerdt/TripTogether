from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class TripChecklist(Base):
    """Packing checklist for a trip, generated from the winning route. One per trip (regenerate overwrites)."""
    __tablename__ = "trip_checklists"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # JSON: { "categories": [ { "name": "Документы", "items": ["Паспорт", ...] }, ... ] }
    content = Column(JSON, nullable=False)

    trip = relationship("Trip", back_populates="checklist")
    created_by = relationship("User", back_populates="checklists")

    def __repr__(self):
        return f"<TripChecklist(trip_id={self.trip_id})>"
