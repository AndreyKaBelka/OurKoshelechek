package transaction

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestNewTransaction_Transfer(t *testing.T) {
	sender := uuid.New()
	recipient := uuid.New()
	categoryID := uuid.New()

	tests := []struct {
		name        string
		txType      Type
		categoryID  *uuid.UUID
		payerMode   PayerMode
		payerUserID *uuid.UUID
		recipientID *uuid.UUID
		wantErr     error
	}{
		{"valid transfer", TypeTransfer, nil, PayerModeUser, &sender, &recipient, nil},
		{"transfer without recipient", TypeTransfer, nil, PayerModeUser, &sender, nil, ErrRecipientRequired},
		{"transfer to self", TypeTransfer, nil, PayerModeUser, &sender, &sender, ErrTransferToSelf},
		{"transfer with category", TypeTransfer, &categoryID, PayerModeUser, &sender, &recipient, ErrCategoryNotAllowedForTransfer},
		{"split transfer", TypeTransfer, nil, PayerModeSplit, nil, &recipient, ErrTransferPayerModeUser},
		{"expense with recipient", TypeExpense, &categoryID, PayerModeUser, &sender, &recipient, ErrRecipientNotAllowed},
		{"income with recipient", TypeIncome, nil, PayerModeUser, &sender, &recipient, ErrRecipientNotAllowed},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			now := time.Now()
			_, err := NewTransaction(uuid.New(), uuid.New(), tt.txType, 100, tt.categoryID, tt.payerMode, tt.payerUserID, tt.recipientID, now, nil, sender, now, now)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("NewTransaction() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}
