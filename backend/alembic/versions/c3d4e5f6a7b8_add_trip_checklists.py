"""add trip_checklists table

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-02-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'trip_checklists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('trip_id', sa.Integer(), nullable=False),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('content', sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_trip_checklists_id'), 'trip_checklists', ['id'], unique=False)
    op.create_index(op.f('ix_trip_checklists_trip_id'), 'trip_checklists', ['trip_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_trip_checklists_trip_id'), table_name='trip_checklists')
    op.drop_index(op.f('ix_trip_checklists_id'), table_name='trip_checklists')
    op.drop_table('trip_checklists')
