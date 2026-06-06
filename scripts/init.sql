-- Schema do AccessChain — controle de acesso com DID/VC

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Issuers: universidade e agremiações
CREATE TABLE issuers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    did VARCHAR(256) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('university', 'association')),
    public_key BYTEA NOT NULL,
    encrypted_private_key BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Salas associadas a agremiações
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    association_id UUID NOT NULL REFERENCES issuers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credenciais emitidas
CREATE TABLE credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credential_type VARCHAR(30) NOT NULL CHECK (credential_type IN (
        'AlunoCredential',
        'CoordenacaoCredential',
        'ColaboradorCredential',
        'MembroCredential',
        'VisitanteCredential'
    )),
    issuer_id UUID NOT NULL REFERENCES issuers(id),
    issuer_did VARCHAR(256) NOT NULL,
    subject_did VARCHAR(256) NOT NULL,
    jwt TEXT NOT NULL,
    claims JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired', 'used')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT
);

-- Aprovações de visitante (fluxo de email)
CREATE TABLE visitor_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credential_id UUID REFERENCES credentials(id),
    visitor_name VARCHAR(200) NOT NULL,
    visitor_email VARCHAR(200) NOT NULL,
    approver_did VARCHAR(256) NOT NULL,
    approval_token UUID NOT NULL DEFAULT uuid_generate_v4(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    room_id UUID NOT NULL REFERENCES rooms(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

-- Log de verificações de acesso
CREATE TABLE access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    subject_did VARCHAR(256) NOT NULL,
    credential_type VARCHAR(30) NOT NULL,
    credential_id UUID REFERENCES credentials(id),
    granted BOOLEAN NOT NULL,
    reason TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nonces emitidos pelo verifier (anti-replay)
CREATE TABLE nonces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nonce VARCHAR(64) NOT NULL UNIQUE,
    room_id UUID NOT NULL REFERENCES rooms(id),
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Índices para consultas frequentes
CREATE INDEX idx_credentials_subject ON credentials(subject_did);
CREATE INDEX idx_credentials_status ON credentials(status);
CREATE INDEX idx_credentials_type_subject ON credentials(credential_type, subject_did);
CREATE INDEX idx_access_logs_room ON access_logs(room_id, verified_at DESC);
CREATE INDEX idx_nonces_value ON nonces(nonce);
CREATE INDEX idx_visitor_approvals_token ON visitor_approvals(approval_token);
