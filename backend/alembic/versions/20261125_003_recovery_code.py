"""recovery_code: adiciona código de recuperação de senha (hash Argon2id) na tabela users

Revision ID: 20261125_003
Revises: 20261021_002
Create Date: 2026-11-25 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20261125_003'
down_revision: Union[str, None] = '20261021_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('recovery_code_hash', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('recovery_code_generated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'recovery_code_generated_at')
    op.drop_column('users', 'recovery_code_hash')
