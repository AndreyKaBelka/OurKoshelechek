package refreshtoken

import (
	"bytes"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestNewRefreshToken(t *testing.T) {
	now := time.Now()
	userID := uuid.New()

	rt, secret, err := NewRefreshToken(uuid.New(), userID, time.Hour, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if secret == "" || !bytes.Equal(rt.TokenHash, Hash(secret)) {
		t.Fatalf("stored hash doesn't match returned secret")
	}
	if rt.UserID != userID || !rt.ExpiresAt.Equal(now.Add(time.Hour)) {
		t.Fatalf("unexpected token: %+v", rt)
	}

	_, other, _ := NewRefreshToken(uuid.New(), userID, time.Hour, now)
	if other == secret {
		t.Fatalf("two tokens got the same secret")
	}
}

func TestNewRefreshTokenInvalidTTL(t *testing.T) {
	if _, _, err := NewRefreshToken(uuid.New(), uuid.New(), 0, time.Now()); !errors.Is(err, ErrInvalidTTL) {
		t.Fatalf("expected ErrInvalidTTL, got %v", err)
	}
}
