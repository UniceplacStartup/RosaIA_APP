"""initial_schema

Revision ID: 20261016_001
Revises: 
Create Date: 2026-10-16 18:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import pgvector
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '20261016_001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extensões
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')

    # 2. Tabela users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('full_name', sa.String(150), nullable=False),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('cpf_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('cpf_encrypted', sa.LargeBinary(), nullable=False),
        sa.Column('cpf_masked', sa.String(14), nullable=False, server_default='***.***.***-**'),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('role', sa.String(20), nullable=False, server_default='patient'),
        sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_locked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_cpf_hash', 'users', ['cpf_hash'])

    # 3. Tabela user_consents
    op.create_table(
        'user_consents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('terms_version', sa.String(20), nullable=False, server_default='v1.0-2026'),
        sa.Column('accepted_terms_of_use', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('accepted_medical_disclaimer', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('accepted_lgpd_health_data', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('ip_hash', sa.String(64), nullable=False),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('consented_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_consents_user_id', 'user_consents', ['user_id'])

    # 4. Tabela chat_threads
    op.create_table(
        'chat_threads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(120), nullable=False, server_default='Conversa com a Doutora Rosa'),
        sa.Column('current_emotional_state', sa.String(40), nullable=False, server_default='acolhimento_inicial'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.create_index('idx_chat_threads_user', 'chat_threads', ['user_id'])

    # 5. Tabela uploaded_documents (sem imagens - apenas PDF/DOCX/TXT)
    op.create_table(
        'uploaded_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('thread_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('chat_threads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('original_filename', sa.String(255), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('sha256_checksum', sa.String(64), nullable=False),
        sa.Column('extracted_text_anonymized', sa.Text(), nullable=False),
        sa.Column('document_category', sa.String(50), nullable=False, server_default='laudo_mamografia'),
        sa.Column('birads_mentioned', sa.String(20), nullable=True),
        sa.Column('ai_educational_analysis', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_documents_user', 'uploaded_documents', ['user_id'])

    # 6. Tabela chat_messages
    op.create_table(
        'chat_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('thread_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('chat_threads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_type', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('detected_emotion', sa.String(40), nullable=True),
        sa.Column('psychological_support_triggered', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('attached_document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('uploaded_documents.id', ondelete='SET NULL'), nullable=True),
        sa.Column('rag_references', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('response_latency_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_chat_messages_thread', 'chat_messages', ['thread_id'])

    # 7. Tabela triage_assessments
    op.create_table(
        'triage_assessments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('age_range', sa.String(30), nullable=False),
        sa.Column('has_family_history', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reported_signs', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('emotional_impact_level', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('attention_level', sa.String(25), nullable=False),
        sa.Column('ai_guidance_summary', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_triage_user', 'triage_assessments', ['user_id'])

    # 8. Tabela health_reminders
    op.create_table(
        'health_reminders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reminder_type', sa.String(30), nullable=False),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('scheduled_for', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_reminders_user', 'health_reminders', ['user_id'])

    # 9. Tabela knowledge_base_chunks (pgvector 768-dim)
    op.create_table(
        'knowledge_base_chunks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('source_institution', sa.String(100), nullable=False),
        sa.Column('reference_url', sa.Text(), nullable=True),
        sa.Column('topic_category', sa.String(50), nullable=False),
        sa.Column('content_text', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(768), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 10. Tabela security_audit_logs
    op.create_table(
        'security_audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('ip_hash', sa.String(64), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_audit_event_type', 'security_audit_logs', ['event_type'])


def downgrade() -> None:
    op.drop_table('security_audit_logs')
    op.drop_table('knowledge_base_chunks')
    op.drop_table('health_reminders')
    op.drop_table('triage_assessments')
    op.drop_table('chat_messages')
    op.drop_table('uploaded_documents')
    op.drop_table('chat_threads')
    op.drop_table('user_consents')
    op.drop_table('users')
