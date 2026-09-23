-- +goose Up
-- +goose StatementBegin

-- Refresh-токены (opaque, хранится только SHA-256 хеш). Каждый токен одноразовый:
-- при обновлении старый помечается revoked_at и выдаётся новый (ротация).
CREATE TABLE refresh_tokens
(
    id         UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash BYTEA       NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS refresh_tokens;

-- +goose StatementEnd
