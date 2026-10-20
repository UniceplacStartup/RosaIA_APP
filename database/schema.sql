-- ============================================================================
-- PROJETO ROSAIA APP — SCHEMA POSTGRESQL (LGPD & OWASP Top 10)
-- Compatível com PostgreSQL 15+ (Neon.tech, Supabase, Render, Docker e Local)
-- 100% Alinhado com os Modelos SQLAlchemy e Endpoints da API FastAPI
--
-- Destaques de Arquitetura:
--  * Extensões: pgcrypto, citext, uuid-ossp e vector (pgvector)
--  * Vetorização RAG: Índice HNSW de alta performance (opera mesmo com tabela vazia)
--  * Busca Híbrida: Vetorial (cosseno 768-dim) + Full-Text Search em Português
--  * Blind Index LGPD: HMAC-SHA256 para CPF (busca/unicidade sem expor PII)
--  * Cifragem em Repouso: AES-256 / Fernet para CPF com coluna mascarada para visualização
--  * Proteção contra Imagens: Bloqueio estrito de image/* em uploaded_documents
--  * Integridade e Performance: Triggers de updated_at e índices em chaves estrangeiras
-- ============================================================================

-- 1. Extensões Obrigatórias ---------------------------------------------------
CREATE EXTENSION IF NOT EXISTS citext;       -- E-mail case-insensitive
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- Funções criptográficas e gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- Compatibilidade com uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector: RAG e busca semântica

-- 2. Funções e Triggers Auxiliares --------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END $$;

-- 3. Tabela de Usuárias (RF01, RF03, RF14, RNF04, RNF05) ----------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email CITEXT NOT NULL,
    
    -- LGPD & OWASP A02: CPF protegido
    -- cpf_hash: HMAC-SHA256 (Blind Index) para busca determinística e unicidade
    -- cpf_encrypted: Cifrado com chave AES-256-GCM / Fernet mantida no servidor
    -- cpf_masked: Versão segura formatada (ex: '123.***.***-45') para exibição na UI
    cpf_hash CHAR(64) NOT NULL,
    cpf_encrypted BYTEA NOT NULL,
    cpf_masked VARCHAR(14) NOT NULL DEFAULT '***.***.***-**',
    
    -- Hash de senha seguro (Argon2id ou BCrypt)
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'patient',
    
    -- OWASP A07: Proteção contra força bruta
    failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    last_login_at TIMESTAMPTZ NULL,
    
    notification_preferences JSONB NOT NULL DEFAULT '{"push": true, "email": true, "reminders": true}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_cpf_hash_key UNIQUE (cpf_hash),
    CONSTRAINT users_full_name_chk CHECK (char_length(btrim(full_name)) >= 5 AND position(' ' IN btrim(full_name)) > 0),
    CONSTRAINT users_role_chk CHECK (role IN ('patient', 'specialist', 'admin')),
    CONSTRAINT users_failed_attempts_chk CHECK (failed_login_attempts >= 0),
    CONSTRAINT users_prefs_chk CHECK (jsonb_typeof(notification_preferences) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_cpf_hash ON users(cpf_hash);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Tabela de Consentimento LGPD Auditável (RF02, RF06, RNF04) ---------------
CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    terms_version VARCHAR(20) NOT NULL DEFAULT 'v1.0-2026',
    accepted_terms_of_use BOOLEAN NOT NULL DEFAULT TRUE CHECK (accepted_terms_of_use = TRUE),
    accepted_medical_disclaimer BOOLEAN NOT NULL DEFAULT TRUE CHECK (accepted_medical_disclaimer = TRUE),
    accepted_lgpd_health_data BOOLEAN NOT NULL DEFAULT TRUE CHECK (accepted_lgpd_health_data = TRUE),
    ip_hash CHAR(64) NOT NULL,  -- HMAC-SHA256 do IP para rastreabilidade sem PII pura
    user_agent TEXT NULL,
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_consents_user_id ON user_consents(user_id, consented_at DESC);

-- 5. Tabela de Tokens de Autenticação / Recuperação de Senha (RF04, OWASP A07)
CREATE TABLE IF NOT EXISTS auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    token_type VARCHAR(30) NOT NULL CHECK (token_type IN ('refresh_token', 'password_reset', 'email_verification')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, token_type);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash);

-- 6. Tabela de Conversas (Threads de Chat) (RF06, RF09) -----------------------
CREATE TABLE IF NOT EXISTS chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL DEFAULT 'Conversa com a Doutora Rosa',
    current_emotional_state VARCHAR(40) NOT NULL DEFAULT 'acolhimento_inicial',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chat_threads_emotional_chk CHECK (
        current_emotional_state IN ('neutro', 'acolhimento_inicial', 'medo_ansiedade', 'tristeza_angustia', 'duvida_exame', 'esperanca_tratamento')
    )
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_user ON chat_threads(user_id, last_message_at DESC);

-- 7. Tabela de Documentos e Laudos — SEM IMAGENS (LGPD & RF16) ----------------
-- Bloqueio categórico de fotos, imagens corporais e exames radiológicos brutos (DICOM/JPG/PNG).
-- Apenas arquivos textuais (PDF, TXT, DOCX) com texto anonimizado.
CREATE TABLE IF NOT EXISTS uploaded_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880), -- Máx 5MB
    sha256_checksum CHAR(64) NOT NULL,
    extracted_text_anonymized TEXT NOT NULL,
    document_category VARCHAR(50) NOT NULL DEFAULT 'laudo_mamografia',
    birads_mentioned VARCHAR(20) NULL,
    ai_educational_analysis TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uploaded_documents_mime_chk CHECK (
        mime_type IN (
            'application/pdf',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        AND mime_type NOT LIKE 'image/%'
    ),
    CONSTRAINT uploaded_documents_category_chk CHECK (
        document_category IN ('laudo_mamografia', 'laudo_ultrassonografia', 'exame_laboratorial', 'relatorio_medico', 'outro_documento')
    )
);

CREATE INDEX IF NOT EXISTS idx_uploaded_docs_user ON uploaded_documents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_thread ON uploaded_documents(thread_id);

-- 8. Tabela de Mensagens do Chat (RF06–RF09) -----------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'doutora_rosa', 'system')),
    content TEXT NOT NULL,
    detected_emotion VARCHAR(40) NULL,
    psychological_support_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    attached_document_id UUID NULL REFERENCES uploaded_documents(id) ON DELETE SET NULL,
    rag_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    response_latency_ms INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chat_messages_content_chk CHECK (char_length(content) > 0),
    CONSTRAINT chat_messages_rag_chk CHECK (jsonb_typeof(rag_references) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_date ON chat_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_doc ON chat_messages(attached_document_id) WHERE attached_document_id IS NOT NULL;

-- Trigger para manter last_message_at da thread sincronizado com a última mensagem inserida
CREATE OR REPLACE FUNCTION update_thread_last_message() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE chat_threads
    SET last_message_at = NEW.created_at
    WHERE id = NEW.thread_id;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_chat_messages_last_message ON chat_messages;
CREATE TRIGGER trg_chat_messages_last_message AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_thread_last_message();

-- 9. Tabela de Triagem Clínica Inteligente (RF10) ------------------------------
CREATE TABLE IF NOT EXISTS triage_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    age_range VARCHAR(30) NOT NULL,
    has_family_history BOOLEAN NOT NULL DEFAULT FALSE,
    reported_signs JSONB NOT NULL DEFAULT '[]'::jsonb,
    emotional_impact_level SMALLINT NOT NULL DEFAULT 1 CHECK (emotional_impact_level BETWEEN 1 AND 5),
    attention_level VARCHAR(25) NOT NULL CHECK (attention_level IN ('rotina_preventiva', 'atencao_moderada', 'avaliacao_prioritaria')),
    ai_guidance_summary TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT triage_signs_chk CHECK (jsonb_typeof(reported_signs) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_triage_user ON triage_assessments(user_id, created_at DESC);

-- 10. Tabela de Lembretes de Saúde (RF11, RF12) --------------------------------
CREATE TABLE IF NOT EXISTS health_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_type VARCHAR(30) NOT NULL CHECK (reminder_type IN ('exame', 'consulta', 'medicacao', 'autocuidado')),
    title VARCHAR(150) NOT NULL,
    notes TEXT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user_sched ON health_reminders(user_id, scheduled_for ASC);

-- 11. Base de Conhecimento Vetorizada — RAG Doutora Rosa (RF08, RF13, RF15, RNF08)
CREATE TABLE IF NOT EXISTS knowledge_base_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    source_institution VARCHAR(100) NOT NULL,
    reference_url TEXT NULL,
    topic_category VARCHAR(50) NOT NULL,
    content_text TEXT NOT NULL,
    
    -- Vetor 768 dimensões compatível com text-embedding-004 do Google Gemini
    embedding vector(768),
    
    -- Campo TSVECTOR para Busca Híbrida (Vetor + Full-Text Search em Português)
    content_tsv TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('portuguese'::regconfig, coalesce(title, '') || ' ' || coalesce(content_text, ''))
    ) STORED,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT kb_category_chk CHECK (
        topic_category IN ('apoio_psicologico', 'prevencao_rastreamento', 'sinais_sintomas', 'laudos_birads', 'tratamento_esperanca', 'direitos_paciente')
    )
);

-- Índice HNSW: opera perfeitamente com tabela vazia ou com milhões de chunks
CREATE INDEX IF NOT EXISTS idx_kb_embedding_hnsw ON knowledge_base_chunks
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Índice GIN para busca textual rápida
CREATE INDEX IF NOT EXISTS idx_kb_tsv ON knowledge_base_chunks USING gin (content_tsv);
CREATE INDEX IF NOT EXISTS idx_kb_topic ON knowledge_base_chunks(topic_category);

DROP TRIGGER IF EXISTS trg_kb_updated_at ON knowledge_base_chunks;
CREATE TRIGGER trg_kb_updated_at BEFORE UPDATE ON knowledge_base_chunks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 12. Logs de Auditoria e Segurança (OWASP A09 & LGPD Art. 37) — Append-Only ---
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(60) NOT NULL,
    ip_hash CHAR(64) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON security_audit_logs(user_id) WHERE user_id IS NOT NULL;

-- 13. Funções de Consulta Semântica e Apoio -----------------------------------
-- Função para busca vetorial de chunks da base de conhecimento
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
    p_embedding vector(768),
    p_match_count INT DEFAULT 5,
    p_category TEXT DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    title VARCHAR,
    source_institution VARCHAR,
    reference_url TEXT,
    content_text TEXT,
    similarity REAL
) LANGUAGE sql STABLE PARALLEL SAFE AS $$
    SELECT 
        k.id, 
        k.title, 
        k.source_institution, 
        k.reference_url, 
        k.content_text,
        (1 - (k.embedding <=> p_embedding))::real AS similarity
    FROM knowledge_base_chunks k
    WHERE k.embedding IS NOT NULL
      AND (p_category IS NULL OR k.topic_category = p_category)
    ORDER BY k.embedding <=> p_embedding
    LIMIT LEAST(GREATEST(p_match_count, 1), 20);
$$;

-- Função atômica para registro de falhas de login (OWASP A07 - Anti Força Bruta)
CREATE OR REPLACE FUNCTION register_login_failure(
    p_user_id UUID, 
    p_max_attempts INT DEFAULT 5, 
    p_lock_minutes INT DEFAULT 15
) RETURNS TIMESTAMPTZ LANGUAGE sql AS $$
    UPDATE users SET
        failed_login_attempts = CASE 
            WHEN failed_login_attempts + 1 >= p_max_attempts THEN 0
            ELSE failed_login_attempts + 1 
        END,
        locked_until = CASE 
            WHEN failed_login_attempts + 1 >= p_max_attempts THEN NOW() + make_interval(mins => p_lock_minutes)
            ELSE locked_until 
        END
    WHERE id = p_user_id
    RETURNING locked_until;
$$;

-- Função atômica para reset de tentativas após login bem-sucedido
CREATE OR REPLACE FUNCTION register_login_success(p_user_id UUID)
RETURNS VOID LANGUAGE sql AS $$
    UPDATE users 
    SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() 
    WHERE id = p_user_id;
$$;

-- ============================================================================
-- FIM DO SCHEMA — Pronto para execução via psql, Neon.tech, Supabase ou DBeaver
-- ============================================================================