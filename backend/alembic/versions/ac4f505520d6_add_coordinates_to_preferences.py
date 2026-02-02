"""add_coordinates_to_preferences

Revision ID: ac4f505520d6
Revises: a1b2c3d4e5f6
Create Date: 2026-02-02 14:24:14.169635

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ac4f505520d6'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add coordinates columns to place_preferences table
    op.add_column('place_preferences', sa.Column('latitude', sa.Numeric(10, 8), nullable=True))
    op.add_column('place_preferences', sa.Column('longitude', sa.Numeric(11, 8), nullable=True))
    op.add_column('place_preferences', sa.Column('yandex_place_id', sa.String(length=255), nullable=True))


def downgrade() -> None:
    # Remove coordinates columns
    op.drop_column('place_preferences', 'yandex_place_id')
    op.drop_column('place_preferences', 'longitude')
    op.drop_column('place_preferences', 'latitude')
