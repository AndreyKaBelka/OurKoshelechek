package category

import (
	"errors"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/samber/lo"
)

type Category struct {
	ID                 uuid.UUID
	GroupID            uuid.UUID
	Name               string
	Icon               string
	MonthlyLimitAmount *int
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

var ErrNameEmpty = errors.New("category name must not be empty")
var ErrNameTooLong = errors.New("category name too long")
var ErrInvalidMonthlyLimitAmount = errors.New("monthly limit amount must be positive")
var ErrWrongTimeFormat = errors.New("updated at before created at")

func NewCategory(id, groupID uuid.UUID, name, icon string, monthlyLimitAmount *int, createdAt, updatedAt *time.Time) (*Category, error) {
	if len(name) == 0 {
		return nil, ErrNameEmpty
	}

	if utf8.RuneCountInString(name) > 50 {
		return nil, ErrNameTooLong
	}

	if monthlyLimitAmount != nil && *monthlyLimitAmount <= 0 {
		return nil, ErrInvalidMonthlyLimitAmount
	}

	if createdAt != nil && updatedAt.Before(*createdAt) {
		return nil, ErrWrongTimeFormat
	}

	return &Category{
		ID:                 id,
		GroupID:            groupID,
		Name:               name,
		Icon:               icon,
		MonthlyLimitAmount: monthlyLimitAmount,
		CreatedAt:          lo.FromPtr(createdAt),
		UpdatedAt:          lo.FromPtr(updatedAt),
	}, nil
}
