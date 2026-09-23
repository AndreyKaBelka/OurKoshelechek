package refreshtoken

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"OurKoshelechek/internal/platform"
)

// ErrNotFound is returned when no active (unrevoked, unexpired) token
// matches the given hash.
var ErrNotFound = errors.New("refresh token not found")

type Repository struct {
	db platform.DBTX
}

func New(db platform.DBTX) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, t RefreshToken) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`, t.ID, t.UserID, t.TokenHash, t.ExpiresAt, t.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert refresh token: %w", err)
	}
	return nil
}

// Consume atomically revokes the active token with the given hash and
// returns its owner. A single UPDATE makes concurrent uses of the same token
// race-safe: only one caller gets the user id, the rest get ErrNotFound.
func (r *Repository) Consume(ctx context.Context, tokenHash []byte) (uuid.UUID, error) {
	var userID uuid.UUID
	err := r.db.QueryRow(ctx, `
		UPDATE refresh_tokens
		SET revoked_at = now()
		WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
		RETURNING user_id
	`, tokenHash).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.UUID{}, ErrNotFound
		}
		return uuid.UUID{}, fmt.Errorf("consume refresh token: %w", err)
	}
	return userID, nil
}

// DeleteExpired removes tokens of userID that can no longer be used, so the
// table doesn't grow unboundedly with every rotation.
func (r *Repository) DeleteExpired(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM refresh_tokens
		WHERE user_id = $1 AND (revoked_at IS NOT NULL OR expires_at <= now())
	`, userID)
	if err != nil {
		return fmt.Errorf("delete expired refresh tokens: %w", err)
	}
	return nil
}
