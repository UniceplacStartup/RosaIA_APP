-- ============================================================================
-- PROJETO ROSAIA APP — MODELAGEM DE BANCO DE DADOS POSTGRESQL (LGPD & OWASP 10)
-- Compatível com: Neon.tech (Free Tier), Supabase (Free Tier) e Aiven
-- Inclui: pgvector (RAG da Doutora Rosa), pgcrypto, Blind Index de CPF e
-- bloqueio estrito de imagens (apenas laudos/documentos em texto/PDF).
-- ============================================================================

-- 1. Extensões Obrigatórias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector"; -- RNF08: RAG com base médica vetorizada

-- 2. Tabela de Usuárias (RF01, RF03, RF14, RNF04, RNF05 + OWASP Top 10)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL CHECK (char_length(trim(full_name)) >= 5 AND position(' ' in trim(full_name)) > 0),
    email VARCHAR(255) NOT NULL UNIQUE,
    -- LGPD & OWASP A02 (Cryptographic Failures):
    -- O CPF NUNCA é salvo em texto puro.
    -- cpf_hash: HMAC-SHA256 (Blind Index) para busca rápida e garantia de unicidade (UNIQUE)
    -- cpf_encrypted: CPF criptografado com AES-256-GCM (chave no servidor) caso precise exibir mascarado
    cpf_hash CHAR(64) NOT NULL UNIQUE,
    cpf_encrypted BYTEA NOT NULL,
    cpf_masked CHAR(14) NOT NULL DEFAULT '***.***.***-**',
    -- RNF05: Hash de senha forte (Argon2id ou BCrypt cost >= 12)
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'specialist', 'admin')),
    -- OWASP A07 (Identification & Authentication Failures): Proteção contra força bruta
    failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    last_login_at TIMESTAMPTZ NULL,
    notification_preferences JSONB NOT NULL DEFAULT '{"push": true, "email": true, "reminders": true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- LGPD Art. 18: Exclusão permanente (hard delete) ou anonimização irreversível
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_cpf_hash ON users(cpf_hash);

-- 3. Tabela de Aceite de Termos e Consentimento LGPD (RF02, RF06, RNF04)
CREATE TABLE user_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    terms_version VARCHAR(20) NOT NULL DEFAULT 'v1.0-2026',
    accepted_terms_of_use BOOLEAN NOT NULL DEFAULT TRUE CHECK (accepted_terms_of_use = TRUE),
    accepted_medical_disclaimer BOOLEAN NOT NULL DEFAULT TRUE CHECK (accepted_medical_disclaimer = TRUE),
    accepted_lgpd_health_data BOOLEAN NOT NULL DEFAULT TRUE CHECK (accepted_lgpd_health_data = TRUE),
    ip_hash CHAR(64) NOT NULL, -- Hash SHA-256 do IP para auditoria sem expor PII
    user_agent TEXT,
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_consents_user_id ON user_consents(user_id);

-- 4. Tabela de Sessões e Recuperação de Senha (RF03, RF04, OWASP A07)
CREATE TABLE auth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    token_type VARCHAR(30) NOT NULL CHECK (token_type IN ('refresh_token', 'password_reset')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id, token_type);

-- 5. Tabela de Conversas Recorrentes — Estilo WhatsApp (RF06, RF09, RF10-front)
-- Permite que a usuária tenha sua conversa contínua (ex: iniciada em 02/09 e alimentada diariamente)
CREATE TABLE chat_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL DEFAULT 'Conversa com a Doutora Rosa',
    current_emotional_state VARCHAR(40) NOT NULL DEFAULT 'acolhimento_inicial'
        CHECK (current_emotional_state IN ('neutro', 'acolhimento_inicial', 'medo_ansiedade', 'tristeza_angustia', 'duvida_exame', 'esperanca_tratamento')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_chat_threads_user ON chat_threads(user_id, last_message_at DESC);

-- 6. Tabela de Upload de Exames e Documentos — SEM IMAGENS (LGPD & RF16)
-- REGRA ESTRITA DE NEGÓCIO E LGPD: Imagens (image/*, DICOM, fotos) são PROIBIDAS.
-- Apenas PDF, TXT ou DOCX com extração de texto anonimizado no backend.
CREATE TABLE uploaded_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL CHECK (
        mime_type IN (
            'application/pdf',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        AND mime_type NOT LIKE 'image/%'
    ),
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880), -- Máx 5MB
    sha256_checksum CHAR(64) NOT NULL,
    -- Texto extraído do laudo já ANONIMIZADO (sem CPF, RG ou nome completo da paciente)
    extracted_text_anonymized TEXT NOT NULL,
    document_category VARCHAR(50) NOT NULL DEFAULT 'laudo_mamografia'
        CHECK (document_category IN ('laudo_mamografia', 'laudo_ultrassonografia', 'exame_laboratorial', 'relatorio_medico', 'outro_documento')),
    birads_mentioned VARCHAR(20) NULL, -- Ex: 'BI-RADS 1', 'BI-RADS 2', 'BI-RADS 3', 'BI-RADS 4'
    ai_educational_analysis TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uploaded_docs_user ON uploaded_documents(user_id, created_at DESC);

-- 7. Tabela de Mensagens do Chat (RF06, RF07, RF08, RF09)
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'doutora_rosa', 'system')),
    content TEXT NOT NULL,
    -- RF07: Registro do sentimento/contexto emocional identificado na mensagem
    detected_emotion VARCHAR(40) NULL,
    psychological_support_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    attached_document_id UUID NULL REFERENCES uploaded_documents(id) ON DELETE SET NULL,
    rag_references JSONB NOT NULL DEFAULT '[]'::jsonb, -- Artigos/diretrizes usados na resposta
    response_latency_ms INTEGER NULL, -- RNF03: Monitoramento de meta < 3000ms
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice composto para paginação rápida estilo WhatsApp agrupada por data
CREATE INDEX idx_chat_messages_thread_date ON chat_messages(thread_id, created_at ASC);

-- 8. Tabela de Triagem Inteligente de Risco Oncológico (RF10)
CREATE TABLE triage_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    age_range VARCHAR(30) NOT NULL,
    has_family_history BOOLEAN NOT NULL DEFAULT FALSE,
    reported_signs JSONB NOT NULL DEFAULT '[]'::jsonb, -- Ex: ["caroço indolor", "alteração na pele"]
    emotional_impact_level SMALLINT NOT NULL DEFAULT 1 CHECK (emotional_impact_level BETWEEN 1 AND 5),
    attention_level VARCHAR(25) NOT NULL CHECK (attention_level IN ('rotina_preventiva', 'atencao_moderada', 'avaliacao_prioritaria')),
    ai_guidance_summary TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Tabela de Lembretes de Exames, Consultas e Medicações (RF11, RF12)
CREATE TABLE health_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_type VARCHAR(30) NOT NULL CHECK (reminder_type IN ('exame', 'consulta', 'medicacao', 'autocuidado')),
    title VARCHAR(150) NOT NULL,
    notes TEXT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reminders_user_sched ON health_reminders(user_id, scheduled_for ASC);

-- 10. Base de Conhecimento Médico e Apoio Psicológico Vetorizada — RAG (RF08, RF13, RF15, RNF08)
-- Alimentada com INCA, Ministério da Saúde e os artigos publicados do Projeto RosaIA / UNICEPLAC
CREATE TABLE knowledge_base_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    source_institution VARCHAR(100) NOT NULL, -- Ex: 'UNICEPLAC / RIPE UnB', 'INCA', 'Ministério da Saúde', 'BJRTR'
    reference_url TEXT NULL,
    topic_category VARCHAR(50) NOT NULL CHECK (
        topic_category IN ('apoio_psicologico', 'prevencao_rastreamento', 'sinais_sintomas', 'laudos_birads', 'tratamento_esperanca', 'direitos_paciente')
    ),
    content_text TEXT NOT NULL,
    -- Vetor de 768 dimensões compatível com Google Gemini text-embedding-004 (gratuito)
    embedding vector(768),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_embedding ON knowledge_base_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- 11. Logs de Auditoria e Segurança (OWASP A09 & LGPD Art. 37)
CREATE TABLE security_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(60) NOT NULL, -- Ex: 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'IMAGE_UPLOAD_BLOCKED_LGPD', 'ACCOUNT_DELETED_LGPD'
    ip_hash CHAR(64) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_created ON security_audit_logs(created_at DESC);
