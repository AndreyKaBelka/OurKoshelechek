package category

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"OurKoshelechek/internal/platform"
)

var ErrNotFound = errors.New("category not found")

type Repository struct {
	db platform.DBTX
}

func New(db platform.DBTX) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, c *Category) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO categories (id, group_id, name, icon, monthly_limit_amount, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, c.ID, c.GroupID, c.Name, c.Icon, c.MonthlyLimitAmount, c.CreatedAt, c.UpdatedAt)
	if err != nil {
		return fmt.Errorf("insert category: %w", err)
	}
	return nil
}

func (r *Repository) GetByID(ctx context.Context, groupID, id uuid.UUID) (*Category, error) {
	var c Category
	err := r.db.QueryRow(ctx, `
		SELECT id, group_id, name, icon, monthly_limit_amount, created_at, updated_at
		FROM categories
		WHERE group_id = $1 AND id = $2
	`, groupID, id).Scan(&c.ID, &c.GroupID, &c.Name, &c.Icon, &c.MonthlyLimitAmount, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("select category: %w", err)
	}
	return &c, nil
}

// GetOrCreate inserts c and returns it, or, if a category with the same
// (group_id, name) already exists (enforced by the idx_categories_group_id_name
// unique index), returns that existing row instead. Atomic under concurrent
// callers racing to create the same well-known category (e.g. the goal
// "Накопления" category on a group's first contribution) — unlike a
// GetByName-then-Create check, it can't create duplicates or lose a race to
// an unrelated row that hasn't committed yet.
func (r *Repository) GetOrCreate(ctx context.Context, c *Category) (*Category, error) {
	var out Category
	err := r.db.QueryRow(ctx, `
		INSERT INTO categories (id, group_id, name, icon, monthly_limit_amount, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (group_id, name) DO NOTHING
		RETURNING id, group_id, name, icon, monthly_limit_amount, created_at, updated_at
	`, c.ID, c.GroupID, c.Name, c.Icon, c.MonthlyLimitAmount, c.CreatedAt, c.UpdatedAt).
		Scan(&out.ID, &out.GroupID, &out.Name, &out.Icon, &out.MonthlyLimitAmount, &out.CreatedAt, &out.UpdatedAt)
	if err == nil {
		return &out, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("insert category: %w", err)
	}
	return r.GetByName(ctx, c.GroupID, c.Name)
}

// GetByName returns the group's category with the given exact name, or
// ErrNotFound. Used to find well-known categories such as the "Накопления"
// savings category that goal contributions post expenses against.
func (r *Repository) GetByName(ctx context.Context, groupID uuid.UUID, name string) (*Category, error) {
	var c Category
	err := r.db.QueryRow(ctx, `
		SELECT id, group_id, name, icon, monthly_limit_amount, created_at, updated_at
		FROM categories
		WHERE group_id = $1 AND name = $2
	`, groupID, name).Scan(&c.ID, &c.GroupID, &c.Name, &c.Icon, &c.MonthlyLimitAmount, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("select category by name: %w", err)
	}
	return &c, nil
}

func (r *Repository) Update(ctx context.Context, c *Category) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE categories
		SET name = $3, icon = $4, monthly_limit_amount = $5, updated_at = $6
		WHERE group_id = $1 AND id = $2
	`, c.GroupID, c.ID, c.Name, c.Icon, c.MonthlyLimitAmount, c.UpdatedAt)
	if err != nil {
		return fmt.Errorf("update category: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, groupID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM categories WHERE group_id = $1 AND id = $2
	`, groupID, id)
	if err != nil {
		return fmt.Errorf("delete category: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) ListByGroup(ctx context.Context, groupID uuid.UUID) ([]Category, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, group_id, name, icon, monthly_limit_amount, created_at, updated_at
		FROM categories
		WHERE group_id = $1
		ORDER BY created_at DESC
	`, groupID)
	if err != nil {
		return nil, fmt.Errorf("select categories: %w", err)
	}
	defer rows.Close()

	var categories []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.GroupID, &c.Name, &c.Icon, &c.MonthlyLimitAmount, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		categories = append(categories, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate categories: %w", err)
	}
	return categories, nil
}
