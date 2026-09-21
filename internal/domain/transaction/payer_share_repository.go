package transaction

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"OurKoshelechek/internal/platform"
)

type PayerShareRepository struct {
	db platform.DBTX
}

func NewPayerShareRepository(db platform.DBTX) *PayerShareRepository {
	return &PayerShareRepository{db: db}
}

func (r *PayerShareRepository) Create(ctx context.Context, shares ...PayerShare) error {
	for _, s := range shares {
		_, err := r.db.Exec(ctx, `
			INSERT INTO transaction_payer_shares (transaction_id, user_id, amount)
			VALUES ($1, $2, $3)
		`, s.TransactionID, s.UserID, s.Amount)
		if err != nil {
			return fmt.Errorf("insert payer share for user %s: %w", s.UserID, err)
		}
	}
	return nil
}

func (r *PayerShareRepository) ListByTransaction(ctx context.Context, transactionID uuid.UUID) ([]PayerShare, error) {
	rows, err := r.db.Query(ctx, `
		SELECT transaction_id, user_id, amount
		FROM transaction_payer_shares
		WHERE transaction_id = $1
		ORDER BY user_id
	`, transactionID)
	if err != nil {
		return nil, fmt.Errorf("select payer shares: %w", err)
	}
	defer rows.Close()

	var shares []PayerShare
	for rows.Next() {
		var s PayerShare
		if err := rows.Scan(&s.TransactionID, &s.UserID, &s.Amount); err != nil {
			return nil, fmt.Errorf("scan payer share: %w", err)
		}
		shares = append(shares, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate payer shares: %w", err)
	}
	return shares, nil
}

// DeleteByTransaction removes all shares for a transaction, used before
// re-inserting a fresh set on update.
func (r *PayerShareRepository) DeleteByTransaction(ctx context.Context, transactionID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM transaction_payer_shares WHERE transaction_id = $1
	`, transactionID)
	if err != nil {
		return fmt.Errorf("delete payer shares: %w", err)
	}
	return nil
}
