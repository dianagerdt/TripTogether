"""add reactions

Revision ID: a1b2c3d4e5f6
Revises: 43ee48dca56d
Create Date: 2026-01-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '43ee48dca56d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'reactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('preference_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('emoji', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['preference_id'], ['place_preferences.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('preference_id', 'user_id', name='_preference_user_reaction_uc')
    )
    op.create_index(op.f('ix_reactions_id'), 'reactions', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_reactions_id'), table_name='reactions')
    op.drop_table('reactions')
