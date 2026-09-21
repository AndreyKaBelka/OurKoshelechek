package budget

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type Split struct {
	GroupID      uuid.UUID
	BudgetPeriod time.Time
	UserID       uuid.UUID
	ShareAmount  int64
	UpdatedAt    time.Time
}

var ErrInvalidShareAmount = errors.New("share amount must be positive")

func NewSplit(groupID, userID uuid.UUID, budgetPeriod time.Time, shareAmount int64, updatedAt time.Time) (*Split, error) {
	if shareAmount <= 0 {
		return nil, ErrInvalidShareAmount
	}

	return &Split{
		GroupID:      groupID,
		BudgetPeriod: budgetPeriod,
		UserID:       userID,
		ShareAmount:  shareAmount,
		UpdatedAt:    updatedAt,
	}, nil
}
