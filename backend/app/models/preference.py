import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class PlaceType(str, enum.Enum):
    MUSEUM = "museum"
    PARK = "park"
    VIEWPOINT = "viewpoint"
    FOOD = "food"
    ACTIVITY = "activity"
    DISTRICT = "district"
    OTHER = "other"


class PlacePreference(Base):
    __tablename__ = "place_preferences"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    country = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    location = Column(String(255), nullable=True)  # Optional specific place
    
    place_type = Column(Enum(PlaceType), default=PlaceType.OTHER, nullable=False)
    priority = Column(Integer, default=3)  # 1-5, default middle
    comment = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    trip = relationship("Trip", back_populates="preferences")
    user = relationship("User", back_populates="preferences")

    def __repr__(self):
        return f"<PlacePreference(id={self.id}, country={self.country}, city={self.city})>"
