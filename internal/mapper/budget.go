package mapper

import (
	"time"

	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/budget"
)

func ToModelBudgetSplit(s *budget.Split) *model.BudgetSplit {
	return &model.BudgetSplit{
		UserID:      s.UserID,
		ShareAmount: &model.Money{Amount: int(s.ShareAmount)},
	}
}

// ToModelBudgetSplits converts a list of domain splits to GraphQL models.
func ToModelBudgetSplits(splits []budget.Split) []*model.BudgetSplit {
	result := make([]*model.BudgetSplit, 0, len(splits))
	for i := range splits {
		result = append(result, ToModelBudgetSplit(&splits[i]))
	}
	return result
}

func ToDomainBudgetSplit(m *model.BudgetSplit, groupID uuid.UUID, period, updatedAt time.Time) *budget.Split {
	amount := 0
	if m.ShareAmount != nil {
		amount = m.ShareAmount.Amount
	}
	return &budget.Split{
		GroupID:      groupID,
		BudgetPeriod: period,
		UserID:       m.UserID,
		ShareAmount:  int64(amount),
		UpdatedAt:    updatedAt,
	}
}
