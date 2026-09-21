package user

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"OurKoshelechek/internal/platform"
)

var ErrNotFound = errors.New("user not found")

type Repository struct {
	db platform.DBTX
}

func New(db platform.DBTX) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, u User) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO users (id, username, password_hash)
		VALUES ($1, $2, $3)
	`, u.ID, u.Username, u.PasswordHash)
	if err != nil {
		return fmt.Errorf("insert user: %w", err)
	}
	return nil
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	return r.scanOne(ctx, `
		SELECT id, username, password_hash, created_at, updated_at
		FROM users
		WHERE id = $1
	`, id)
}

func (r *Repository) GetByUsername(ctx context.Context, username string) (*User, error) {
	return r.scanOne(ctx, `
		SELECT id, username, password_hash, created_at, updated_at
		FROM users
		WHERE username = $1
	`, username)
}

func (r *Repository) scanOne(ctx context.Context, sql string, args ...any) (*User, error) {
	var u User
	err := r.db.QueryRow(ctx, sql, args...).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("select user: %w", err)
	}
	return &u, nil
}
