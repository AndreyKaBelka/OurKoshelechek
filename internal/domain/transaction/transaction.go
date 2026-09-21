package transaction

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type Type string

const (
	TypeIncome  Type = "income"
	TypeExpense Type = "expense"
)

type PayerMode string

const (
	PayerModeUser  PayerMode = "user"
	PayerModeSplit PayerMode = "split"
)

type Transaction struct {
	ID          uuid.UUID
	GroupID     uuid.UUID
	Type        Type
	Amount      int64
	CategoryID  uuid.UUID
	PayerMode   PayerMode
	PayerUserID *uuid.UUID
	Date        time.Time
	Comment     *string
	CreatedBy   uuid.UUID
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

var ErrInvalidType = errors.New("invalid transaction type")
var ErrInvalidPayerMode = errors.New("invalid payer mode")
var ErrPayerUserRequired = errors.New("payer user id is required for user payer mode")
var ErrInvalidAmount = errors.New("transaction amount must be positive")
var ErrCommentTooLong = errors.New("comment too long")
var ErrWrongTimeFormat = errors.New("updated at before created at")

func NewTransaction(id, groupID uuid.UUID, txType Type, amount int64, categoryID uuid.UUID, payerMode PayerMode, payerUserID *uuid.UUID, date time.Time, comment *string, createdBy uuid.UUID, createdAt, updatedAt time.Time) (*Transaction, error) {
	switch txType {
	case TypeIncome, TypeExpense:
	default:
		return nil, ErrInvalidType
	}

	if amount <= 0 {
		return nil, ErrInvalidAmount
	}

	switch payerMode {
	case PayerModeUser, PayerModeSplit:
	default:
		return nil, ErrInvalidPayerMode
	}

	if payerMode == PayerModeUser && payerUserID == nil {
		return nil, ErrPayerUserRequired
	}

	if comment != nil && len(*comment) > 500 {
		return nil, ErrCommentTooLong
	}

	if updatedAt.Before(createdAt) {
		return nil, ErrWrongTimeFormat
	}

	return &Transaction{
		ID:          id,
		GroupID:     groupID,
		Type:        txType,
		Amount:      amount,
		CategoryID:  categoryID,
		PayerMode:   payerMode,
		PayerUserID: payerUserID,
		Date:        date,
		Comment:     comment,
		CreatedBy:   createdBy,
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}, nil
}

type PayerShare struct {
	TransactionID uuid.UUID
	UserID        uuid.UUID
	Amount        int64
}

var ErrInvalidShareAmount = errors.New("share amount must be positive")

func NewPayerShare(transactionID, userID uuid.UUID, amount int64) (*PayerShare, error) {
	if amount <= 0 {
		return nil, ErrInvalidShareAmount
	}

	return &PayerShare{
		TransactionID: transactionID,
		UserID:        userID,
		Amount:        amount,
	}, nil
}
