package budget

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"OurKoshelechek/internal/platform"
)

type Repository struct {
	db platform.DBTX
}

func New(db platform.DBTX) *Repository {
	return &Repository{db: db}
}

// UpsertSplit creates or replaces a user's share for a group/period.
func (r *Repository) UpsertSplit(ctx context.Context, s Split) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO budget_splits (group_id, budget_period, user_id, share_amount, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (group_id, budget_period, user_id)
		DO UPDATE SET share_amount = excluded.share_amount, updated_at = excluded.updated_at
	`, s.GroupID, s.BudgetPeriod, s.UserID, s.ShareAmount, s.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert budget split: %w", err)
	}
	return nil
}

func (r *Repository) ListByGroupPeriod(ctx context.Context, groupID uuid.UUID, period time.Time) ([]Split, error) {
	rows, err := r.db.Query(ctx, `
		SELECT group_id, budget_period, user_id, share_amount, updated_at
		FROM budget_splits
		WHERE group_id = $1 AND budget_period = $2
		ORDER BY user_id
	`, groupID, period)
	if err != nil {
		return nil, fmt.Errorf("select budget splits: %w", err)
	}
	defer rows.Close()

	var splits []Split
	for rows.Next() {
		var s Split
		if err := rows.Scan(&s.GroupID, &s.BudgetPeriod, &s.UserID, &s.ShareAmount, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan budget split: %w", err)
		}
		splits = append(splits, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate budget splits: %w", err)
	}
	return splits, nil
}
