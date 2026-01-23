import enum
import secrets
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Date, Enum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class GenerationStatus(str, enum.Enum):
    IDLE = "idle"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class ParticipantRole(str, enum.Enum):
    ORGANIZER = "organizer"
    PARTICIPANT = "participant"


def generate_invite_code() -> str:
    """Generate a unique 8-character invite code."""
    return secrets.token_urlsafe(6)[:8]


class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    
    invite_code = Column(String(20), unique=True, index=True, default=generate_invite_code)
    
    generation_status = Column(
        Enum(GenerationStatus), 
        default=GenerationStatus.IDLE,
        nullable=False
    )
    generation_count = Column(Integer, default=0)
    
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    created_by = relationship("User", back_populates="created_trips")
    participants = relationship("TripParticipant", back_populates="trip", cascade="all, delete-orphan")
    preferences = relationship("PlacePreference", back_populates="trip", cascade="all, delete-orphan")
    route_options = relationship("RouteOption", back_populates="trip", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Trip(id={self.id}, title={self.title})>"


class TripParticipant(Base):
    __tablename__ = "trip_participants"
    __table_args__ = (
        UniqueConstraint('trip_id', 'user_id', name='unique_trip_user'),
    )

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    role = Column(
        Enum(ParticipantRole), 
        default=ParticipantRole.PARTICIPANT,
        nullable=False
    )
    
    joined_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    trip = relationship("Trip", back_populates="participants")
    user = relationship("User", back_populates="trip_participations")

    def __repr__(self):
        return f"<TripParticipant(trip_id={self.trip_id}, user_id={self.user_id}, role={self.role})>"
