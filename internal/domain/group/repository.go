package group

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"OurKoshelechek/internal/platform"
)

var ErrNotFound = errors.New("group not found")

type Repository struct {
	db platform.DBTX
}

func New(db platform.DBTX) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, g Group) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO groups (id, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4)
	`, g.ID, g.Name, g.CreatedAt, g.UpdatedAt)
	if err != nil {
		return fmt.Errorf("insert group: %w", err)
	}
	return nil
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*Group, error) {
	var g Group
	err := r.db.QueryRow(ctx, `
		SELECT id, name, created_at, updated_at
		FROM groups
		WHERE id = $1
	`, id).Scan(&g.ID, &g.Name, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("select group: %w", err)
	}
	return &g, nil
}

func (r *Repository) Update(ctx context.Context, g Group) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE groups
		SET name = $2, updated_at = $3
		WHERE id = $1
	`, g.ID, g.Name, g.UpdatedAt)
	if err != nil {
		return fmt.Errorf("update group: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListByUser returns the groups a user belongs to, most recently updated first.
func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]Group, error) {
	rows, err := r.db.Query(ctx, `
		SELECT g.id, g.name, g.created_at, g.updated_at
		FROM groups g
		JOIN group_members m ON m.group_id = g.id
		WHERE m.user_id = $1
		ORDER BY g.updated_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("select groups by user: %w", err)
	}
	defer rows.Close()

	var groups []Group
	for rows.Next() {
		var g Group
		if err := rows.Scan(&g.ID, &g.Name, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan group: %w", err)
		}
		groups = append(groups, g)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate groups: %w", err)
	}
	return groups, nil
}
