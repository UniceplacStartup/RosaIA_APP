"""ai_feedback_loop: telemetria da IA, feedback das usuárias e curadoria da base RAG

Revision ID: 20261021_002
Revises: 20261016_001
Create Date: 2026-10-21 13:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '20261021_002'
down_revision: Union[str, None] = '20261016_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Telemetria por resposta
    op.add_column('chat_messages', sa.Column('ai_model', sa.String(60), nullable=True))
    op.add_column('chat_messages', sa.Column('used_fallback', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('chat_messages', sa.Column('prompt_tokens', sa.Integer(), nullable=True))
    op.add_column('chat_messages', sa.Column('completion_tokens', sa.Integer(), nullable=True))
    op.add_column('chat_messages', sa.Column('urgency_level', sa.String(20), nullable=False, server_default='none'))
    op.add_column('chat_messages', sa.Column('emotion_source', sa.String(10), nullable=True))

    # Base de conhecimento: origem, hash de conteúdo e flag de ativo
    op.add_column('knowledge_base_chunks', sa.Column('origin', sa.String(20), nullable=False, server_default='official'))
    op.add_column('knowledge_base_chunks', sa.Column('content_hash', sa.String(64), nullable=True))
    op.add_column('knowledge_base_chunks', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))
    op.create_index('ix_knowledge_base_chunks_origin', 'knowledge_base_chunks', ['origin'])
    op.create_unique_constraint('uq_knowledge_base_chunks_content_hash', 'knowledge_base_chunks', ['content_hash'])

    # Feedback e curadoria
    op.create_table(
        'message_feedback',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('chat_messages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rating', sa.SmallInteger(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('allow_training_use', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('review_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('reviewer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('curated_answer', sa.Text(), nullable=True),
        sa.Column('reviewer_notes', sa.Text(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('kb_chunk_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('knowledge_base_chunks.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('message_id', 'user_id', name='uq_feedback_message_user'),
    )
    op.create_index('ix_message_feedback_message_id', 'message_feedback', ['message_id'])
    op.create_index('ix_message_feedback_user_id', 'message_feedback', ['user_id'])
    op.create_index('ix_message_feedback_review_status', 'message_feedback', ['review_status'])
    op.create_index('ix_message_feedback_created_at', 'message_feedback', ['created_at'])


def downgrade() -> None:
    op.drop_table('message_feedback')
    op.drop_constraint('uq_knowledge_base_chunks_content_hash', 'knowledge_base_chunks', type_='unique')
    op.drop_index('ix_knowledge_base_chunks_origin', table_name='knowledge_base_chunks')
    op.drop_column('knowledge_base_chunks', 'is_active')
    op.drop_column('knowledge_base_chunks', 'content_hash')
    op.drop_column('knowledge_base_chunks', 'origin')
    for col in ('emotion_source', 'urgency_level', 'completion_tokens', 'prompt_tokens', 'used_fallback', 'ai_model'):
        op.drop_column('chat_messages', col)
