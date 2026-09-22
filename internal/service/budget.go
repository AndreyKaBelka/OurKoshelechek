package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/transaction"
	"OurKoshelechek/internal/platform"
	"OurKoshelechek/internal/repository"
)

// BudgetService holds the budget business logic that resolvers previously
// implemented inline: computing the income/allocation breakdown for a
// period. The budget is a plan of category spending limits; it does not
// require or depend on any declared income — income is purely informational
// here, computed from the period's actual INCOME transactions.
type BudgetService struct {
	repositories *repository.Repositories
}

func NewBudgetService(repositories *repository.Repositories) *BudgetService {
	return &BudgetService{repositories: repositories}
}

// Budget returns the income/allocation/free breakdown for groupID over the
// "YYYY-MM" period: income (sum of income transactions in the period, purely
// informational), per-category allocations (categories with a monthly limit
// set), and the income left unallocated.
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

		categoryModels = append(categoryModels, &model.BudgetCategory{
			CategoryID: c.ID,
			Amount:     &model.Money{Amount: int(amount)},
		})
	}

	return &model.Budget{
		Income:         &model.Money{Amount: int(income)},
		Categories:     categoryModels,
		TotalAllocated: &model.Money{Amount: int(totalAllocated)},
		Free:           &model.Money{Amount: int(income - totalAllocated)},
	}, nil
}
