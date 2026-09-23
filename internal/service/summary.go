package service

import (
	"context"
	"fmt"
	"slices"
	"strings"
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

	income, expense, err := s.periodBreakdown(ctx, groupID, from, to)
	if err != nil {
		return nil, err
	}

	return &model.GroupSummary{
		Balance:           &model.Money{Amount: int(balance)},
		BalanceDeltaMonth: &model.Money{Amount: income.Total.Amount - expense.Total.Amount},
		Income:            income,
		Expense:           expense,
	}, nil
}

// PeriodSummary returns the group's income/expense breakdown for an arbitrary
// inclusive day range ("YYYY-MM-DD" bounds).
func (s *SummaryService) PeriodSummary(ctx context.Context, groupID uuid.UUID, dateFrom, dateTo string) (*model.PeriodSummary, error) {
	from, to, err := platform.ParseDateRange(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}

	income, expense, err := s.periodBreakdown(ctx, groupID, from, to)
	if err != nil {
		return nil, err
	}
	return &model.PeriodSummary{Income: income, Expense: expense}, nil
}

// periodBreakdown aggregates the group's income and expense for the half-open
// range [from, to): totals, per-member and per-category (with per-member
// split inside each category) breakdowns.
func (s *SummaryService) periodBreakdown(ctx context.Context, groupID uuid.UUID, from, to time.Time) (*model.IncomeSummary, *model.ExpenseSummary, error) {
	periodIncome, err := s.transactions.SumAmount(ctx, groupID, transaction.TypeIncome, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("sum period income: %w", err)
	}
	periodExpense, err := s.transactions.SumAmount(ctx, groupID, transaction.TypeExpense, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("sum period expense: %w", err)
	}

	// Переводы между участниками не меняют итоги группы, но в разбивке по
	// участникам у отправителя идут в расход, а у получателя — в доход.
	transferRows, err := s.transactions.SumTransfersByMember(ctx, groupID, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("sum period transfers by member: %w", err)
	}
	transfersSent := make(map[uuid.UUID]int64, len(transferRows))
	transfersReceived := make(map[uuid.UUID]int64, len(transferRows))
	for _, row := range transferRows {
		transfersSent[row.UserID] = row.Sent
		transfersReceived[row.UserID] = row.Received
	}

	byMemberRows, err := s.transactions.SumAmountByPayer(ctx, groupID, transaction.TypeIncome, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("sum period income by member: %w", err)
	}
	byMember := memberAmounts(byMemberRows, transfersReceived)

	byCategoryRows, err := s.transactions.SumAmountByCategory(ctx, groupID, transaction.TypeExpense, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("sum period expense by category: %w", err)
	}
	byCategoryMemberRows, err := s.transactions.SumAmountByCategoryAndPayer(ctx, groupID, transaction.TypeExpense, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("sum period expense by category and member: %w", err)
	}
	categoryMembers := make(map[uuid.UUID][]transaction.PayerAmount, len(byCategoryRows))
	for _, row := range byCategoryMemberRows {
		categoryMembers[row.CategoryID] = append(categoryMembers[row.CategoryID], transaction.PayerAmount{UserID: row.UserID, Amount: row.Amount})
	}
	byCategory := make([]*model.CategoryAmount, 0, len(byCategoryRows))
	for _, row := range byCategoryRows {
		byCategory = append(byCategory, &model.CategoryAmount{
			CategoryID: row.CategoryID,
			Amount:     &model.Money{Amount: int(row.Amount)},
			ByMember:   memberAmounts(categoryMembers[row.CategoryID], nil),
		})
	}

	expenseByMemberRows, err := s.transactions.SumAmountByPayer(ctx, groupID, transaction.TypeExpense, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("sum period expense by member: %w", err)
	}
	expenseByMember := memberAmounts(expenseByMemberRows, transfersSent)

	income := &model.IncomeSummary{
		Total:    &model.Money{Amount: int(periodIncome)},
		ByMember: byMember,
	}
	expense := &model.ExpenseSummary{
		Total:      &model.Money{Amount: int(periodExpense)},
		ByCategory: byCategory,
		ByMember:   expenseByMember,
	}
	return income, expense, nil
}

// memberAmounts merges per-payer sums with per-member transfer amounts into a
// MemberAmount list, ordered by user id (the order SumAmountByPayer uses).
func memberAmounts(rows []transaction.PayerAmount, transfers map[uuid.UUID]int64) []*model.MemberAmount {
	totals := make(map[uuid.UUID]int64, len(rows)+len(transfers))
	for _, row := range rows {
		totals[row.UserID] += row.Amount
	}
	for userID, amount := range transfers {
		if amount != 0 {
			totals[userID] += amount
		}
	}

	userIDs := make([]uuid.UUID, 0, len(totals))
	for userID := range totals {
		userIDs = append(userIDs, userID)
	}
	slices.SortFunc(userIDs, func(a, b uuid.UUID) int { return strings.Compare(a.String(), b.String()) })

	result := make([]*model.MemberAmount, 0, len(userIDs))
	for _, userID := range userIDs {
		result = append(result, &model.MemberAmount{
			UserID: userID,
			Amount: &model.Money{Amount: int(totals[userID])},
		})
	}
	return result
}
