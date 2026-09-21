package goal

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"OurKoshelechek/internal/platform"
)

var ErrNotFound = errors.New("goal not found")

type Repository struct {
	db platform.DBTX
}

func New(db platform.DBTX) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, g Goal) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO goals (id, group_id, name, icon, target_amount, type, owner_user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, g.ID, g.GroupID, g.Name, g.Icon, g.TargetAmount, g.Type, g.OwnerUserID, g.CreatedAt, g.UpdatedAt)
	if err != nil {
		return fmt.Errorf("insert goal: %w", err)
	}
	return nil
}

func (r *Repository) GetByID(ctx context.Context, groupID, id uuid.UUID) (*Goal, error) {
	var g Goal
	err := r.db.QueryRow(ctx, `
		SELECT id, group_id, name, icon, target_amount, type, owner_user_id, created_at, updated_at
		FROM goals
		WHERE group_id = $1 AND id = $2
	`, groupID, id).Scan(&g.ID, &g.GroupID, &g.Name, &g.Icon, &g.TargetAmount, &g.Type, &g.OwnerUserID, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("select goal: %w", err)
	}
	return &g, nil
}

func (r *Repository) Update(ctx context.Context, g Goal) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE goals
		SET name = $3, icon = $4, target_amount = $5, type = $6, owner_user_id = $7, updated_at = $8
		WHERE group_id = $1 AND id = $2
	`, g.GroupID, g.ID, g.Name, g.Icon, g.TargetAmount, g.Type, g.OwnerUserID, g.UpdatedAt)
	if err != nil {
		return fmt.Errorf("update goal: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, groupID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM goals WHERE group_id = $1 AND id = $2
	`, groupID, id)
	if err != nil {
		return fmt.Errorf("delete goal: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) ListByGroup(ctx context.Context, groupID uuid.UUID) ([]Goal, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, group_id, name, icon, target_amount, type, owner_user_id, created_at, updated_at
		FROM goals
		WHERE group_id = $1
		ORDER BY created_at
	`, groupID)
	if err != nil {
		return nil, fmt.Errorf("select goals: %w", err)
	}
	defer rows.Close()

	var goals []Goal
	for rows.Next() {
		var g Goal
		if err := rows.Scan(&g.ID, &g.GroupID, &g.Name, &g.Icon, &g.TargetAmount, &g.Type, &g.OwnerUserID, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan goal: %w", err)
		}
		goals = append(goals, g)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate goals: %w", err)
	}
	return goals, nil
}
