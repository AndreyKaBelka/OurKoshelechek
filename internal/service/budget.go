package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/budget"
	"OurKoshelechek/internal/domain/transaction"
	"OurKoshelechek/internal/mapper"
	"OurKoshelechek/internal/platform"
	"OurKoshelechek/internal/repository"
)

// ErrBudgetSplitSumMismatch is returned by UpdateSplit when the given shares
// don't add up to the group's income for the current period, as required by
// the split field's doc comment in the schema.
var ErrBudgetSplitSumMismatch = errors.New("budget split shares must sum to the group's income for the current period")

// BudgetService holds the budget business logic that resolvers previously
// implemented inline: computing the income/allocation breakdown for a
// period, and validating and persisting a group's expense split.
type BudgetService struct {
	repositories *repository.Repositories
	uow          *platform.UnitOfWork
}

func NewBudgetService(repositories *repository.Repositories, uow *platform.UnitOfWork) *BudgetService {
	return &BudgetService{repositories: repositories, uow: uow}
}

// Budget returns the income/allocation/free breakdown for groupID over the
// "YYYY-MM" period: income (sum of income transactions in the period),
// per-category allocations (categories with a monthly limit set), and the
// income left unallocated.
func (s *BudgetService) Budget(ctx context.Context, groupID uuid.UUID, period string) (*model.Budget, error) {
	from, to, err := platform.ParsePeriod(period)
	if err != nil {
		return nil, err
	}

	income, err := s.repositories.Transaction.SumAmount(ctx, groupID, transaction.TypeIncome, from, to)
	if err != nil {
		return nil, fmt.Errorf("sum income: %w", err)
	}

	cats, err := s.repositories.Category.ListByGroup(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("list categories: %w", err)
	}

	var totalAllocated int64
	categoryModels := make([]*model.BudgetCategory, 0, len(cats))
	for _, c := range cats {
		if c.MonthlyLimitAmount == nil {
			continue
		}
		amount := int64(*c.MonthlyLimitAmount)
		totalAllocated += amount

		var pct float64
		if income > 0 {
			pct = float64(amount) / float64(income)
		}

		categoryModels = append(categoryModels, &model.BudgetCategory{
			CategoryID:  c.ID,
			Amount:      &model.Money{Amount: int(amount)},
			PctOfIncome: pct,
		})
	}

	splits, err := s.repositories.Budget.ListByGroupPeriod(ctx, groupID, from)
	if err != nil {
		return nil, fmt.Errorf("list budget splits: %w", err)
	}

	return &model.Budget{
		Income:         &model.Money{Amount: int(income)},
		Split:          mapper.ToModelBudgetSplits(splits),
		Categories:     categoryModels,
		TotalAllocated: &model.Money{Amount: int(totalAllocated)},
		Free:           &model.Money{Amount: int(income - totalAllocated)},
	}, nil
}

// UpdateSplit validates that split sums to the group's income for the
// current calendar month, then persists it atomically and returns the
// resulting rows.
func (s *BudgetService) UpdateSplit(ctx context.Context, groupID uuid.UUID, split []*model.BudgetSplitInput) ([]*model.BudgetSplit, error) {
	from, to, err := platform.ParsePeriod(time.Now().UTC().Format("2006-01"))
	if err != nil {
		return nil, err
	}

	income, err := s.repositories.Transaction.SumAmount(ctx, groupID, transaction.TypeIncome, from, to)
	if err != nil {
		return nil, fmt.Errorf("sum income: %w", err)
	}

	now := time.Now()
	splits := make([]*budget.Split, 0, len(split))
	var sum int64
	for _, m := range split {
		amount := 0
		if m.ShareAmount != nil {
			amount = m.ShareAmount.Amount
		}
		sum += int64(amount)

		sp, err := budget.NewSplit(groupID, m.UserID, from, int64(amount), now)
		if err != nil {
			return nil, err
		}
		splits = append(splits, sp)
	}

	if sum != income {
		return nil, ErrBudgetSplitSumMismatch
	}

	err = repository.RunInTx(ctx, s.uow, func(repos repository.Repositories) error {
		for _, sp := range splits {
			if err := repos.Budget.UpsertSplit(ctx, *sp); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("update budget split: %w", err)
	}

	updated, err := s.repositories.Budget.ListByGroupPeriod(ctx, groupID, from)
	if err != nil {
		return nil, fmt.Errorf("list budget splits: %w", err)
	}
	return mapper.ToModelBudgetSplits(updated), nil
}
