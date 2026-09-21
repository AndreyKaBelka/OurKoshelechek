package goal

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"OurKoshelechek/internal/platform"
)

type ContributionRepository struct {
	db platform.DBTX
}

func NewContributionRepository(db platform.DBTX) *ContributionRepository {
	return &ContributionRepository{db: db}
}

func (r *ContributionRepository) Create(ctx context.Context, c Contribution) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO goal_contributions (id, goal_id, amount, user_id, date, transaction_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, c.ID, c.GoalID, c.Amount, c.UserID, c.Date, c.TransactionID, c.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert goal contribution: %w", err)
	}
	return nil
}

func (r *ContributionRepository) ListByGoal(ctx context.Context, goalID uuid.UUID) ([]Contribution, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, goal_id, amount, user_id, date, transaction_id, created_at
		FROM goal_contributions
		WHERE goal_id = $1
		ORDER BY date DESC
	`, goalID)
	if err != nil {
		return nil, fmt.Errorf("select goal contributions: %w", err)
	}
	defer rows.Close()

	var contributions []Contribution
	for rows.Next() {
		var c Contribution
		if err := rows.Scan(&c.ID, &c.GoalID, &c.Amount, &c.UserID, &c.Date, &c.TransactionID, &c.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan goal contribution: %w", err)
		}
		contributions = append(contributions, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate goal contributions: %w", err)
	}
	return contributions, nil
}

// SumByGoal returns the current amount saved towards a goal, i.e. the sum of
// its contributions (Goal.currentAmount is derived, not stored).
func (r *ContributionRepository) SumByGoal(ctx context.Context, goalID uuid.UUID) (int64, error) {
	var sum int64
	err := r.db.QueryRow(ctx, `
		SELECT coalesce(sum(amount), 0) FROM goal_contributions WHERE goal_id = $1
	`, goalID).Scan(&sum)
	if err != nil {
		return 0, fmt.Errorf("sum goal contributions: %w", err)
	}
	return sum, nil
}
