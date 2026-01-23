from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class RouteOption(Base):
    __tablename__ = "route_options"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    
    option_number = Column(Integer, nullable=False)  # 1, 2, 3
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    reasoning = Column(Text, nullable=True)  # Why this route was suggested
    
    route_data = Column(JSON, nullable=True)  # Detailed itinerary data
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    trip = relationship("Trip", back_populates="route_options")
    votes = relationship("Vote", back_populates="route_option", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<RouteOption(id={self.id}, trip_id={self.trip_id}, title={self.title})>"
