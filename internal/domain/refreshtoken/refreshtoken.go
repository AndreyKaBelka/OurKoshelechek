// Package refreshtoken holds the long-lived, single-use tokens that let a
// client obtain a new access token without re-entering credentials.
package refreshtoken

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// RefreshToken is the stored side of a refresh token: only the SHA-256 hash
// of the secret handed to the client is persisted, so a DB leak doesn't leak
// usable tokens.
type RefreshToken struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	TokenHash []byte
	ExpiresAt time.Time
	RevokedAt *time.Time
	CreatedAt time.Time
}

var ErrInvalidTTL = errors.New("refresh token ttl must be positive")

// NewRefreshToken generates a fresh random secret for userID, valid for ttl.
// It returns the entity to persist and the plaintext secret to hand to the
// client (never stored).
func NewRefreshToken(id, userID uuid.UUID, ttl time.Duration, now time.Time) (*RefreshToken, string, error) {
	if ttl <= 0 {
		return nil, "", ErrInvalidTTL
	}

	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return nil, "", fmt.Errorf("generate refresh token: %w", err)
	}
	secret := base64.RawURLEncoding.EncodeToString(buf)

	return &RefreshToken{
		ID:        id,
		UserID:    userID,
		TokenHash: Hash(secret),
		ExpiresAt: now.Add(ttl),
		CreatedAt: now,
	}, secret, nil
}

// Hash returns the value stored in token_hash for a plaintext secret.
func Hash(secret string) []byte {
	sum := sha256.Sum256([]byte(secret))
	return sum[:]
}
