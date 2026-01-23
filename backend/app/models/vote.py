from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class Vote(Base):
    __tablename__ = "votes"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    route_option_id = Column(Integer, ForeignKey("route_options.id", ondelete="CASCADE"), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="votes")
    route_option = relationship("RouteOption", back_populates="votes")

    # Unique constraint: one vote per user per route option
    __table_args__ = (
        UniqueConstraint('user_id', 'route_option_id', name='uq_user_route_vote'),
    )

    def __repr__(self):
        return f"<Vote(user_id={self.user_id}, route_option_id={self.route_option_id})>"
