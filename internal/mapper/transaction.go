package mapper

import (
	"time"

	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/transaction"
)

func ToModelTransactionType(t transaction.Type) model.TransactionType {
	switch t {
	case transaction.TypeIncome:
		return model.TransactionTypeIncome
	case transaction.TypeExpense:
		return model.TransactionTypeExpense
	default:
		return ""
	}
}

func ToDomainTransactionType(t model.TransactionType) transaction.Type {
	switch t {
	case model.TransactionTypeIncome:
		return transaction.TypeIncome
	case model.TransactionTypeExpense:
		return transaction.TypeExpense
	default:
		return ""
	}
}

func ToModelPayerMode(m transaction.PayerMode) model.PayerMode {
	switch m {
	case transaction.PayerModeUser:
		return model.PayerModeUser
	case transaction.PayerModeSplit:
		return model.PayerModeSplit
	default:
		return ""
	}
}

func ToDomainPayerMode(m model.PayerMode) transaction.PayerMode {
	switch m {
	case model.PayerModeUser:
		return transaction.PayerModeUser
	case model.PayerModeSplit:
		return transaction.PayerModeSplit
	default:
		return ""
	}
}

func ToModelPayerShare(s *transaction.PayerShare) *model.PayerShare {
	return &model.PayerShare{
		UserID: s.UserID,
		Amount: &model.Money{Amount: int(s.Amount)},
	}
}

func ToDomainPayerShare(s *model.PayerShare, transactionID uuid.UUID) *transaction.PayerShare {
	amount := 0
	if s.Amount != nil {
		amount = s.Amount.Amount
	}
	return &transaction.PayerShare{
		TransactionID: transactionID,
		UserID:        s.UserID,
		Amount:        int64(amount),
	}
}

// ToModelPayerShares конвертирует список доменных PayerShare в GraphQL-модели.
func ToModelPayerShares(shares []transaction.PayerShare) []*model.PayerShare {
	result := make([]*model.PayerShare, 0, len(shares))
	for i := range shares {
		result = append(result, ToModelPayerShare(&shares[i]))
	}
	return result
}

// ToModelPayer собирает Payer из полей транзакции и уже сконвертированных shares
// (доли участников хранятся отдельной репозиторной сущностью transaction.PayerShare).
func ToModelPayer(t *transaction.Transaction, shares []*model.PayerShare) *model.Payer {
	return &model.Payer{
		Mode:   ToModelPayerMode(t.PayerMode),
		UserID: t.PayerUserID,
		Shares: shares,
	}
}

// ToModelTransaction собирает Transaction из доменной сущности плюс уже загруженные
// category и shares (Transaction в GraphQL хранит их как вложенные объекты, а не id).
func ToModelTransaction(t *transaction.Transaction, cat *model.Category, shares []*model.PayerShare) *model.Transaction {
	return &model.Transaction{
		ID:        t.ID,
		Type:      ToModelTransactionType(t.Type),
		Amount:    &model.Money{Amount: int(t.Amount)},
		Category:  cat,
		Payer:     ToModelPayer(t, shares),
		Date:      t.Date,
		Comment:   t.Comment,
		CreatedBy: t.CreatedBy,
		CreatedAt: t.CreatedAt,
	}
}

func ToDomainTransaction(m *model.Transaction) *transaction.Transaction {
	t := &transaction.Transaction{
		ID:        m.ID,
		Type:      ToDomainTransactionType(m.Type),
		Date:      m.Date,
		Comment:   m.Comment,
		CreatedBy: m.CreatedBy,
		CreatedAt: m.CreatedAt,
	}
	if m.Amount != nil {
		t.Amount = int64(m.Amount.Amount)
	}
	if m.Category != nil {
		t.CategoryID = m.Category.ID
	}
	if m.Payer != nil {
		t.PayerMode = ToDomainPayerMode(m.Payer.Mode)
		t.PayerUserID = m.Payer.UserID
	}
	return t
}

// ToDomainTransactionFromInput строит и валидирует Transaction через
// transaction.NewTransaction, так что доменные инварианты (сумма > 0,
// обязательный payer.userId при mode = USER и т.д.) всегда проверяются.
func ToDomainTransactionFromInput(m model.CreateTransactionInput, createdBy uuid.UUID, groupID uuid.UUID) (transaction.Transaction, error) {
	amount := 0
	if m.Amount != nil {
		amount = m.Amount.Amount
	}

	var payerMode transaction.PayerMode
	var payerUserID *uuid.UUID
	if m.Payer != nil {
		payerMode = ToDomainPayerMode(m.Payer.Mode)
		payerUserID = m.Payer.UserID
	}

	now := time.Now()
	t, err := transaction.NewTransaction(
		uuid.New(),
		groupID,
		ToDomainTransactionType(m.Type),
		int64(amount),
		m.CategoryID,
		payerMode,
		payerUserID,
		m.Date,
		m.Comment,
		createdBy,
		now,
		now,
	)
	if err != nil {
		return transaction.Transaction{}, err
	}
	return *t, nil
}
