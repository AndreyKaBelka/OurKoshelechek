-- +goose Up
-- +goose StatementBegin

-- Перевод между участниками группы: для отправителя (payer_user_id) это расход,
-- для получателя (recipient_user_id) — доход. На общий баланс группы не влияет.
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'transfer';

-- Обязателен для type = 'transfer', NULL для остальных типов — проверяется в приложении.
ALTER TABLE transactions
    ADD COLUMN recipient_user_id UUID REFERENCES users (id) ON DELETE RESTRICT;

CREATE INDEX idx_transactions_recipient_user_id ON transactions (recipient_user_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DELETE FROM transactions WHERE type = 'transfer';

DROP INDEX IF EXISTS idx_transactions_recipient_user_id;
ALTER TABLE transactions DROP COLUMN IF EXISTS recipient_user_id;

-- Postgres не умеет удалять значение из enum — пересоздаём тип без 'transfer'.
ALTER TYPE transaction_type RENAME TO transaction_type_old;
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
ALTER TABLE transactions
    ALTER COLUMN type TYPE transaction_type USING type::text::transaction_type;
DROP TYPE transaction_type_old;

-- +goose StatementEnd
