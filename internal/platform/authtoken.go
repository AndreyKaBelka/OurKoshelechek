package platform

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// ErrInvalidToken is returned by TokenIssuer.Parse for any token that is
// malformed, expired, or signed with a different key.
var ErrInvalidToken = errors.New("invalid or expired access token")

// TokenIssuer issues and validates the HS256 JWT access tokens returned as
// AuthPayload.accessToken by register/login and expected in the
// Authorization: Bearer <token> header of subsequent requests.
type TokenIssuer struct {
	secret []byte
	ttl    time.Duration
}

func NewTokenIssuer(secret []byte, ttl time.Duration) *TokenIssuer {
	return &TokenIssuer{secret: secret, ttl: ttl}
}

// Issue returns a signed access token for userID together with its lifetime
// in seconds (AuthPayload.expiresIn).
func (t *TokenIssuer) Issue(userID uuid.UUID) (token string, expiresIn int, err error) {
	now := time.Now()
	claims := jwt.RegisteredClaims{
		Subject:   userID.String(),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(t.ttl)),
	}

	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(t.secret)
	if err != nil {
		return "", 0, fmt.Errorf("sign access token: %w", err)
	}
	return signed, int(t.ttl.Seconds()), nil
}

// Parse validates token and returns the user id from its subject claim.
func (t *TokenIssuer) Parse(token string) (uuid.UUID, error) {
	claims := &jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(token, claims, func(tok *jwt.Token) (any, error) {
		if _, ok := tok.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", tok.Header["alg"])
		}
		return t.secret, nil
	})
	if err != nil {
		return uuid.UUID{}, ErrInvalidToken
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.UUID{}, ErrInvalidToken
	}
	return userID, nil
}
