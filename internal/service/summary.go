package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/transaction"
	"OurKoshelechek/internal/platform"
)

// SummaryService holds the group summary business logic that resolvers
// previously implemented inline: aggregating the group's balance, and its
// income/expense breakdown for a period.
type SummaryService struct {
	transactions *transaction.Repository
}

func NewSummaryService(transactions *transaction.Repository) *SummaryService {
	return &SummaryService{transactions: transactions}
}

func (s *SummaryService) Summary(ctx context.Context, groupID uuid.UUID, period string) (*model.GroupSummary, error) {
	from, to, err := platform.ParsePeriod(period)
	if err != nil {
		return nil, err
	}

	balanceIncome, err := s.transactions.SumAmount(ctx, groupID, transaction.TypeIncome, time.Time{}, time.Time{})
	if err != nil {
		return nil, fmt.Errorf("sum all-time income: %w", err)
	}
	balanceExpense, err := s.transactions.SumAmount(ctx, groupID, transaction.TypeExpense, time.Time{}, time.Time{})
	if err != nil {
		return nil, fmt.Errorf("sum all-time expense: %w", err)
	}
	balance := balanceIncome - balanceExpense

	periodIncome, err := s.transactions.SumAmount(ctx, groupID, transaction.TypeIncome, from, to)
	if err != nil {
		return nil, fmt.Errorf("sum period income: %w", err)
	}
	periodExpense, err := s.transactions.SumAmount(ctx, groupID, transaction.TypeExpense, from, to)
	if err != nil {
		return nil, fmt.Errorf("sum period expense: %w", err)
	}
	balanceDeltaMonth := periodIncome - periodExpense

	byMemberRows, err := s.transactions.SumAmountByPayer(ctx, groupID, transaction.TypeIncome, from, to)
	if err != nil {
		return nil, fmt.Errorf("sum period income by member: %w", err)
	}
	byMember := make([]*model.MemberAmount, 0, len(byMemberRows))
	for _, row := range byMemberRows {
		byMember = append(byMember, &model.MemberAmount{
			UserID: row.UserID,
			Amount: &model.Money{Amount: int(row.Amount)},
		})
	}

	byCategoryRows, err := s.transactions.SumAmountByCategory(ctx, groupID, transaction.TypeExpense, from, to)
	if err != nil {
		return nil, fmt.Errorf("sum period expense by category: %w", err)
	}
	byCategory := make([]*model.CategoryAmount, 0, len(byCategoryRows))
	for _, row := range byCategoryRows {
		byCategory = append(byCategory, &model.CategoryAmount{
			CategoryID: row.CategoryID,
			Amount:     &model.Money{Amount: int(row.Amount)},
		})
	}

	return &model.GroupSummary{
		Balance:           &model.Money{Amount: int(balance)},
		BalanceDeltaMonth: &model.Money{Amount: int(balanceDeltaMonth)},
		Income: &model.IncomeSummary{
			Total:    &model.Money{Amount: int(periodIncome)},
			ByMember: byMember,
		},
		Expense: &model.ExpenseSummary{
			Total:      &model.Money{Amount: int(periodExpense)},
			ByCategory: byCategory,
		},
	}, nil
}
