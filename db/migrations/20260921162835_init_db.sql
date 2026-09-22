-- +goose Up
-- +goose StatementBegin

-- ===== users =====

CREATE TABLE users
(
    id            UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    username      TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== groups =====

CREATE TABLE groups
(
    id         UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE group_role AS ENUM ('owner', 'member', 'reader');

-- Участники группы. Один пользователь может состоять в нескольких группах (N:M).
CREATE TABLE group_members
(
    group_id  UUID        NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    user_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role      group_role  NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user_id ON group_members (user_id);

CREATE TYPE group_invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- Приглашение по email-коду (используется, если InviteMemberInput.email задан;
-- при InviteMemberInput.username участник добавляется в group_members напрямую).
CREATE TABLE group_invites
(
    id           UUID PRIMARY KEY             DEFAULT gen_random_uuid(),
    group_id     UUID                NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    invited_user UUID                NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status       group_invite_status NOT NULL DEFAULT 'pending',
    invited_by   UUID                NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ         NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ         NOT NULL
);

CREATE INDEX idx_group_invites_group_id ON group_invites (group_id);
CREATE INDEX idx_group_invites_invited_user ON group_invites (invited_user);

-- ===== categories =====

CREATE TABLE categories
(
    id                   UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    group_id             UUID        NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    name                 TEXT        NOT NULL,
    icon                 TEXT        NOT NULL DEFAULT '',
    monthly_limit_amount BIGINT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_group_id ON categories (group_id);

-- Опирается на неё GetOrCreate для атомарного поиска/создания
-- "well-known" категорий (например, «Накопления» для goal-взносов) без
-- гонки при параллельных запросах.
CREATE UNIQUE INDEX idx_categories_group_id_name ON categories (group_id, name);

-- ===== transactions =====

CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE payer_mode AS ENUM ('user', 'split');

CREATE TABLE transactions
(
    id            UUID PRIMARY KEY          DEFAULT gen_random_uuid(),
    group_id      UUID             NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    type          transaction_type NOT NULL,
    amount        BIGINT           NOT NULL,
    -- NULL для type = 'income' (доходы не привязываются к категории);
    -- обязателен для type = 'expense' — проверяется в приложении.
    -- ON DELETE SET NULL: удаление категории не должно стирать историю операций.
    category_id   UUID             REFERENCES categories (id) ON DELETE SET NULL,
    payer_mode    payer_mode       NOT NULL,
    -- Обязателен при payer_mode = 'user', NULL при payer_mode = 'split'
    -- (при 'split' явные суммы участников — в transaction_payer_shares).
    payer_user_id UUID REFERENCES users (id) ON DELETE RESTRICT,
    date          TIMESTAMPTZ      NOT NULL,
    comment       TEXT,
    created_by    UUID             NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_group_id_date ON transactions (group_id, date DESC);
CREATE INDEX idx_transactions_category_id ON transactions (category_id);
CREATE INDEX idx_transactions_payer_user_id ON transactions (payer_user_id);

-- Явные суммы участников при payer_mode = 'split': кто сколько внёс по этой
-- операции (не обязательно поровну). Сумма amount по всем строкам одной
-- transaction_id должна равняться transactions.amount — проверяется в приложении.
CREATE TABLE transaction_payer_shares
(
    transaction_id UUID   NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
    user_id        UUID   NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    amount         BIGINT NOT NULL,
    PRIMARY KEY (transaction_id, user_id)
);

CREATE INDEX idx_transaction_payer_shares_user_id ON transaction_payer_shares (user_id);

-- ===== goals: цели накоплений =====

CREATE TYPE goal_type AS ENUM ('shared', 'personal');

CREATE TABLE goals
(
    id            UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    group_id      UUID        NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    icon          TEXT,
    target_amount BIGINT      NOT NULL,
    type          goal_type   NOT NULL,
    -- Обязателен при type = 'personal', NULL при type = 'shared' — проверяется в приложении.
    owner_user_id UUID REFERENCES users (id) ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_group_id ON goals (group_id);

-- currentAmount цели — производная величина (SUM(goal_contributions.amount)),
-- отдельно не хранится во избежание рассинхронизации.
CREATE TABLE goal_contributions
(
    id             UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    goal_id        UUID        NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
    amount         BIGINT      NOT NULL,
    user_id        UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    -- Дата, к которой пользователь относит взнос (может отличаться от created_at —
    -- взнос задним числом, перенос истории и т.п.); по умолчанию = now().
    date           TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Операция-расход категории «Накопления», созданная одновременно со взносом.
    transaction_id UUID        REFERENCES transactions (id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goal_contributions_goal_id ON goal_contributions (goal_id);
CREATE INDEX idx_goal_contributions_user_id ON goal_contributions (user_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS goal_contributions;
DROP TABLE IF EXISTS goals;
DROP TYPE IF EXISTS goal_type;

DROP TABLE IF EXISTS transaction_payer_shares;
DROP TABLE IF EXISTS transactions;
DROP TYPE IF EXISTS payer_mode;
DROP TYPE IF EXISTS transaction_type;

DROP TABLE IF EXISTS categories;

DROP TABLE IF EXISTS group_invites;
DROP TYPE IF EXISTS group_invite_status;
DROP TABLE IF EXISTS group_members;
DROP TYPE IF EXISTS group_role;
DROP TABLE IF EXISTS groups;

DROP TABLE IF EXISTS users;

-- +goose StatementEnd
