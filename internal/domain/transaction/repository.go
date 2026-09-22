package transaction

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"OurKoshelechek/internal/platform"
)

var ErrNotFound = errors.New("transaction not found")

const selectColumns = `id, group_id, type, amount, category_id, payer_mode, payer_user_id,
	date, comment, created_by, created_at, updated_at`

type Repository struct {
	db platform.DBTX
}

func New(db platform.DBTX) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, t Transaction) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO transactions
			(id, group_id, type, amount, category_id, payer_mode, payer_user_id,
			 date, comment, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`,
		t.ID, t.GroupID, t.Type, t.Amount, t.CategoryID, t.PayerMode, t.PayerUserID,
		t.Date, t.Comment, t.CreatedBy, t.CreatedAt, t.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert transaction: %w", err)
	}
	return nil
}

func (r *Repository) GetByID(ctx context.Context, groupID, id uuid.UUID) (*Transaction, error) {
	t, err := scanOne(r.db.QueryRow(ctx, `
		SELECT `+selectColumns+`
		FROM transactions
		WHERE group_id = $1 AND id = $2
	`, groupID, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("select transaction: %w", err)
	}
	return t, nil
}

func (r *Repository) Update(ctx context.Context, t Transaction) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE transactions
		SET type = $3, amount = $4, category_id = $5, payer_mode = $6, payer_user_id = $7,
			date = $8, comment = $9, updated_at = $10
		WHERE group_id = $1 AND id = $2
	`,
		t.GroupID, t.ID, t.Type, t.Amount, t.CategoryID, t.PayerMode, t.PayerUserID,
		t.Date, t.Comment, t.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("update transaction: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, groupID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM transactions WHERE group_id = $1 AND id = $2
	`, groupID, id)
	if err != nil {
		return fmt.Errorf("delete transaction: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Filter narrows List to transactions matching all non-nil fields.
type Filter struct {
	Type        *Type
	CategoryID  *uuid.UUID
	PayerUserID *uuid.UUID
	DateFrom    *time.Time
	DateTo      *time.Time
}

// List returns up to `first` transactions for a group matching filter, newest date first
// (date DESC, id DESC), along with whether more rows follow and the total count of matching
// rows (independent of pagination). IDs are UUIDv7 (see platform.NewID), so id DESC reliably
// breaks ties within the same date (the date column only carries day-level precision from the
// client) in creation order, unlike the random order plain v4 ids would give. Pagination is
// keyset-based: after, when non-nil, is the id of the last item from the previous page, and
// rows are filtered to those strictly after it in the (date, id) ordering.
func (r *Repository) List(ctx context.Context, groupID uuid.UUID, filter Filter, first int, after *uuid.UUID) ([]Transaction, bool, int, error) {
	where := []string{"group_id = $1"}
	args := []any{groupID}

	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}
	if filter.Type != nil {
		add("type = $%d", *filter.Type)
	}
	if filter.CategoryID != nil {
		add("category_id = $%d", *filter.CategoryID)
	}
	if filter.PayerUserID != nil {
		add("payer_user_id = $%d", *filter.PayerUserID)
	}
	if filter.DateFrom != nil {
		add("date >= $%d", *filter.DateFrom)
	}
	if filter.DateTo != nil {
		add("date <= $%d", *filter.DateTo)
	}
	whereClause := strings.Join(where, " AND ")

	var total int
	if err := r.db.QueryRow(ctx, "SELECT count(*) FROM transactions WHERE "+whereClause, args...).Scan(&total); err != nil {
		return nil, false, 0, fmt.Errorf("count transactions: %w", err)
	}

	pageWhere := whereClause
	if after != nil {
		args = append(args, *after)
		pageWhere += fmt.Sprintf(" AND (date, id) < (SELECT date, id FROM transactions WHERE id = $%d)", len(args))
	}

	// Fetch one extra row to detect whether a next page exists.
	args = append(args, first+1)
	limitArg := len(args)
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT %s FROM transactions
		WHERE %s
		ORDER BY date DESC, id DESC
		LIMIT $%d
	`, selectColumns, pageWhere, limitArg), args...)
	if err != nil {
		return nil, false, 0, fmt.Errorf("select transactions: %w", err)
	}
	defer rows.Close()

	var transactions []Transaction
	for rows.Next() {
		t, err := scanOne(rows)
		if err != nil {
			return nil, false, 0, fmt.Errorf("scan transaction: %w", err)
		}
		transactions = append(transactions, *t)
	}
	if err := rows.Err(); err != nil {
		return nil, false, 0, fmt.Errorf("iterate transactions: %w", err)
	}

	hasMore := len(transactions) > first
	if hasMore {
		transactions = transactions[:first]
	}
	return transactions, hasMore, total, nil
}

// SumAmount returns the total amount of txType transactions for groupID with
// date in the half-open range [from, to). A zero from/to leaves that bound
// unset, so a zero/zero pair sums across all time (used for the running
// balance).
func (r *Repository) SumAmount(ctx context.Context, groupID uuid.UUID, txType Type, from, to time.Time) (int64, error) {
	where := []string{"group_id = $1", "type = $2"}
	args := []any{groupID, txType}
	if !from.IsZero() {
		args = append(args, from)
		where = append(where, fmt.Sprintf("date >= $%d", len(args)))
	}
	if !to.IsZero() {
		args = append(args, to)
		where = append(where, fmt.Sprintf("date < $%d", len(args)))
	}

	var sum int64
	err := r.db.QueryRow(ctx, `
		SELECT coalesce(sum(amount), 0) FROM transactions WHERE `+strings.Join(where, " AND "),
		args...,
	).Scan(&sum)
	if err != nil {
		return 0, fmt.Errorf("sum transaction amount: %w", err)
	}
	return sum, nil
}

// CategoryAmount is one row of a SumAmountByCategory result.
type CategoryAmount struct {
	CategoryID uuid.UUID
	Amount     int64
}

// SumAmountByCategory returns, for each category with at least one matching
// row, the total amount of txType transactions for groupID with date in the
// half-open range [from, to), grouped by category. Rows left uncategorized
// (category_id NULL, e.g. after their category was deleted) are excluded —
// there's no BudgetCategory for them to attach to.
func (r *Repository) SumAmountByCategory(ctx context.Context, groupID uuid.UUID, txType Type, from, to time.Time) ([]CategoryAmount, error) {
	rows, err := r.db.Query(ctx, `
		SELECT category_id, sum(amount)
		FROM transactions
		WHERE group_id = $1 AND type = $2 AND date >= $3 AND date < $4 AND category_id IS NOT NULL
		GROUP BY category_id
		ORDER BY category_id
	`, groupID, txType, from, to)
	if err != nil {
		return nil, fmt.Errorf("sum transaction amount by category: %w", err)
	}
	defer rows.Close()

	var result []CategoryAmount
	for rows.Next() {
		var ca CategoryAmount
		if err := rows.Scan(&ca.CategoryID, &ca.Amount); err != nil {
			return nil, fmt.Errorf("scan category amount: %w", err)
		}
		result = append(result, ca)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate category amounts: %w", err)
	}
	return result, nil
}

// PayerAmount is one row of a SumAmountByPayer result.
type PayerAmount struct {
	UserID uuid.UUID
	Amount int64
}

// SumAmountByPayer returns, for each user with at least one matching row,
// the total amount of txType transactions for groupID with date in the
// half-open range [from, to), attributed per user: the full amount for
// payer_mode = 'user' transactions, and each member's individual share for
// payer_mode = 'split' transactions.
func (r *Repository) SumAmountByPayer(ctx context.Context, groupID uuid.UUID, txType Type, from, to time.Time) ([]PayerAmount, error) {
	rows, err := r.db.Query(ctx, `
		SELECT user_id, sum(amount) FROM (
			SELECT payer_user_id AS user_id, amount
			FROM transactions
			WHERE group_id = $1 AND type = $2 AND payer_mode = 'user' AND date >= $3 AND date < $4
			UNION ALL
			SELECT tps.user_id, tps.amount
			FROM transaction_payer_shares tps
			JOIN transactions t ON t.id = tps.transaction_id
			WHERE t.group_id = $1 AND t.type = $2 AND t.payer_mode = 'split' AND t.date >= $3 AND t.date < $4
		) x
		GROUP BY user_id
		ORDER BY user_id
	`, groupID, txType, from, to)
	if err != nil {
		return nil, fmt.Errorf("sum transaction amount by payer: %w", err)
	}
	defer rows.Close()

	var result []PayerAmount
	for rows.Next() {
		var pa PayerAmount
		if err := rows.Scan(&pa.UserID, &pa.Amount); err != nil {
			return nil, fmt.Errorf("scan payer amount: %w", err)
		}
		result = append(result, pa)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate payer amounts: %w", err)
	}
	return result, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanOne(row rowScanner) (*Transaction, error) {
	var t Transaction
	err := row.Scan(&t.ID, &t.GroupID, &t.Type, &t.Amount, &t.CategoryID, &t.PayerMode, &t.PayerUserID,
		&t.Date, &t.Comment, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}
