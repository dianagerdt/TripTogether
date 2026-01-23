from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Reaction(Base):
    """Emoji reactions to preferences."""
    __tablename__ = "reactions"

    id = Column(Integer, primary_key=True, index=True)
    preference_id = Column(Integer, ForeignKey("place_preferences.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    emoji = Column(String(10), nullable=False)  # Single emoji
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    preference = relationship("PlacePreference", back_populates="reactions")
    user = relationship("User", back_populates="reactions")

    # One reaction per user per preference
    __table_args__ = (
        UniqueConstraint('preference_id', 'user_id', name='_preference_user_reaction_uc'),
    )

    def __repr__(self):
        return f"<Reaction(preference_id={self.preference_id}, user_id={self.user_id}, emoji={self.emoji})>"
