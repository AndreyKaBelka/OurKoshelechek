package user

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID           uuid.UUID
	Username     string
	PasswordHash []byte
	CreatedAt    *time.Time
	UpdatedAt    *time.Time
}

var ErrUsernameTooLong = errors.New("username too long")
var ErrInvalidPassword = errors.New("invalid password")
var ErrWrongTimeFormat = errors.New("updated at before created at")

func NewUser(id uuid.UUID, username, password string, createdAt, updatedAt *time.Time) (*User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, ErrInvalidPassword
	}

	if len(username) > 20 {
		return nil, ErrUsernameTooLong
	}

	if createdAt != nil && updatedAt != nil && createdAt.Before(*updatedAt) {
		return nil, ErrWrongTimeFormat
	}

	return &User{
		ID:           id,
		Username:     username,
		PasswordHash: hash,
		CreatedAt:    createdAt,
		UpdatedAt:    updatedAt,
	}, nil
}
