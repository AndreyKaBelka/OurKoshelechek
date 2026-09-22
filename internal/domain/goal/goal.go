package goal

import (
	"errors"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

type Type string

const (
	TypeShared   Type = "shared"
	TypePersonal Type = "personal"
)

type Goal struct {
	ID           uuid.UUID
	GroupID      uuid.UUID
	Name         string
	Icon         *string
	TargetAmount int64
	Type         Type
	OwnerUserID  *uuid.UUID
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Contribution struct {
	ID            uuid.UUID
	GoalID        uuid.UUID
	Amount        int64
	UserID        uuid.UUID
	Date          time.Time
	TransactionID *uuid.UUID
	CreatedAt     time.Time
}

var ErrNameEmpty = errors.New("goal name must not be empty")
var ErrNameTooLong = errors.New("goal name too long")
var ErrInvalidTargetAmount = errors.New("target amount must be positive")
var ErrInvalidGoalType = errors.New("invalid goal type")
var ErrPersonalGoalMissingOwner = errors.New("personal goal must have an owner user id")
var ErrWrongTimeFormat = errors.New("updated at before created at")

func NewGoal(id, groupID uuid.UUID, name string, icon *string, targetAmount int64, goalType Type, ownerUserID *uuid.UUID, createdAt, updatedAt time.Time) (*Goal, error) {
	if len(name) == 0 {
		return nil, ErrNameEmpty
	}

	if utf8.RuneCountInString(name) > 50 {
		return nil, ErrNameTooLong
	}

	if targetAmount <= 0 {
		return nil, ErrInvalidTargetAmount
	}

	if goalType != TypeShared && goalType != TypePersonal {
		return nil, ErrInvalidGoalType
	}

	if goalType == TypePersonal && ownerUserID == nil {
		return nil, ErrPersonalGoalMissingOwner
	}

	if updatedAt.Before(createdAt) {
		return nil, ErrWrongTimeFormat
	}

	return &Goal{
		ID:           id,
		GroupID:      groupID,
		Name:         name,
		Icon:         icon,
		TargetAmount: targetAmount,
		Type:         goalType,
		OwnerUserID:  ownerUserID,
		CreatedAt:    createdAt,
		UpdatedAt:    updatedAt,
	}, nil
}

var ErrInvalidAmount = errors.New("contribution amount must be positive")

func NewContribution(id, goalID uuid.UUID, amount int64, userID uuid.UUID, date time.Time, transactionID *uuid.UUID, createdAt time.Time) (*Contribution, error) {
	if amount <= 0 {
		return nil, ErrInvalidAmount
	}

	return &Contribution{
		ID:            id,
		GoalID:        goalID,
		Amount:        amount,
		UserID:        userID,
		Date:          date,
		TransactionID: transactionID,
		CreatedAt:     createdAt,
	}, nil
}
