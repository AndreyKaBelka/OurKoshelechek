package service

import (
	"OurKoshelechek/internal/platform"
	"OurKoshelechek/internal/repository"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/category"
	"OurKoshelechek/internal/domain/transaction"
	"OurKoshelechek/internal/mapper"
)

// ErrPayerSharesSumMismatch is returned when explicit payer shares for a
// split transaction don't add up to the transaction amount.
var ErrPayerSharesSumMismatch = errors.New("payer shares must sum to the transaction amount")

const (
	defaultTransactionPageSize = 20
	maxTransactionPageSize     = 100
)

// TransactionService holds the transaction business logic that resolvers
// previously implemented inline: building/validating a Transaction,
// persisting it, and assembling the GraphQL response together with its
// category and payer shares.
type TransactionService struct {
	repositories *repository.Repositories
	uow          *platform.UnitOfWork
}

func NewTransactionService(repositories *repository.Repositories, uow *platform.UnitOfWork) *TransactionService {
	return &TransactionService{repositories: repositories, uow: uow}
}

// Create builds and validates a transaction from input, resolves its payer
// shares (explicit or split evenly across the group), persists everything
// in one transaction, and assembles the GraphQL response together with its
// category and payer shares.
func (s *TransactionService) Create(ctx context.Context, groupID uuid.UUID, input model.CreateTransactionInput) (*model.Transaction, error) {
	createdBy, err := platform.CurrentUserID(ctx)
	if err != nil {
		return nil, err
	}

	var cat *category.Category
	if input.CategoryID != nil {
		cat, err = s.repositories.Category.GetByID(ctx, groupID, *input.CategoryID)
		if err != nil {
			return nil, fmt.Errorf("load category %s: %w", *input.CategoryID, err)
		}
	}

	t, err := mapper.ToDomainTransactionFromInput(input, createdBy, groupID)
	if err != nil {
		return nil, err
	}

	if t.RecipientUserID != nil {
		if err := requireGroupMember(ctx, s.repositories, groupID, *t.RecipientUserID); err != nil {
			return nil, err
		}
	}

	shares, err := s.resolveShares(ctx, t, input.Payer)
	if err != nil {
		return nil, err
	}

	err = repository.RunInTx(ctx, s.uow, func(repos repository.Repositories) error {
		if err := repos.Transaction.Create(ctx, t); err != nil {
			return err
		}
		if len(shares) > 0 {
			if err := repos.PayerShare.Create(ctx, shares...); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	var modelShares []*model.PayerShare
	if t.PayerMode == transaction.PayerModeSplit {
		modelShares = mapper.ToModelPayerShares(shares)
	}
	return mapper.ToModelTransaction(&t, mapper.ToModelCategory(cat), modelShares), nil
}

// ErrPayerRequiredOnAmountChange is returned by Update when a split
// transaction's amount changes without new payer shares to match it — the
// old shares would no longer sum to the new amount.
var ErrPayerRequiredOnAmountChange = errors.New("payer shares are required when changing the amount of a split transaction")

// Update applies a partial update to a transaction (nil input fields keep
// the existing value), re-validates the result as a whole via
// transaction.NewTransaction, and reconciles its payer shares: explicit
// shares from input.Payer are resolved the same way Create does, existing
// shares are left untouched when neither payer nor amount changed, and are
// dropped when the transaction is no longer split.
func (s *TransactionService) Update(ctx context.Context, groupID, transactionID uuid.UUID, input model.UpdateTransactionInput) (*model.Transaction, error) {
	existing, err := s.repositories.Transaction.GetByID(ctx, groupID, transactionID)
	if err != nil {
		return nil, fmt.Errorf("load transaction %s: %w", transactionID, err)
	}

	newType := existing.Type
	if input.Type != nil {
		newType = mapper.ToDomainTransactionType(*input.Type)
	}

	newAmount := existing.Amount
	if input.Amount != nil {
		newAmount = int64(input.Amount.Amount)
	}

	newCategoryID := existing.CategoryID
	if input.CategoryID != nil {
		newCategoryID = input.CategoryID
	}
	// Категория есть только у расходов: при смене типа на доход/перевод
	// старая категория сбрасывается, а не превращается в ошибку валидации.
	if newType != transaction.TypeExpense {
		newCategoryID = nil
	}

	newRecipientUserID := existing.RecipientUserID
	if input.RecipientUserID != nil {
		newRecipientUserID = input.RecipientUserID
	}
	if newType != transaction.TypeTransfer {
		newRecipientUserID = nil
	}
	if newRecipientUserID != nil && input.RecipientUserID != nil {
		if err := requireGroupMember(ctx, s.repositories, groupID, *newRecipientUserID); err != nil {
			return nil, err
		}
	}
	// Validated before the DB write below: if newCategoryID doesn't belong to
	// groupID, this must fail before Transaction.Update persists it, not
	// after the surrounding transaction has already committed.
	var cat *category.Category
	if newCategoryID != nil {
		cat, err = s.repositories.Category.GetByID(ctx, groupID, *newCategoryID)
		if err != nil {
			return nil, fmt.Errorf("load category %s: %w", *newCategoryID, err)
		}
	}

	newDate := existing.Date
	if input.Date != nil {
		newDate = *input.Date
	}

	newComment := existing.Comment
	if input.Comment != nil {
		newComment = input.Comment
	}

	newPayerMode := existing.PayerMode
	newPayerUserID := existing.PayerUserID
	if input.Payer != nil {
		newPayerMode = mapper.ToDomainPayerMode(input.Payer.Mode)
		newPayerUserID = input.Payer.UserID
	}

	now := time.Now()
	t, err := transaction.NewTransaction(
		transactionID, groupID, newType, newAmount, newCategoryID, newPayerMode, newPayerUserID,
		newRecipientUserID, newDate, newComment, existing.CreatedBy, existing.CreatedAt, now,
	)
	if err != nil {
		return nil, err
	}

	var newShares []transaction.PayerShare
	sharesChanged := false
	if t.PayerMode == transaction.PayerModeSplit {
		switch {
		case input.Payer != nil:
			newShares, err = s.resolveShares(ctx, *t, input.Payer)
			if err != nil {
				return nil, err
			}
			sharesChanged = true
		case input.Amount != nil:
			return nil, ErrPayerRequiredOnAmountChange
		}
	} else if existing.PayerMode == transaction.PayerModeSplit {
		// Switched from split to user: the old per-member shares no longer apply.
		sharesChanged = true
	}

	err = repository.RunInTx(ctx, s.uow, func(repos repository.Repositories) error {
		if err := repos.Transaction.Update(ctx, *t); err != nil {
			return err
		}
		if sharesChanged {
			if err := repos.PayerShare.DeleteByTransaction(ctx, t.ID); err != nil {
				return err
			}
			if len(newShares) > 0 {
				if err := repos.PayerShare.Create(ctx, newShares...); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	shares, err := s.loadShares(ctx, *t)
	if err != nil {
		return nil, err
	}
	return mapper.ToModelTransaction(t, mapper.ToModelCategory(cat), shares), nil
}

// resolveShares returns the payer shares to persist for t: nil for
// PayerModeUser, the caller-provided shares (validated to sum to t.Amount)
// when given, or an even split across the group's members otherwise, with
// the remainder from integer division handed to the first members so the
// shares still sum exactly to t.Amount. Members whose computed share would
// be zero are skipped.
func (s *TransactionService) resolveShares(ctx context.Context, t transaction.Transaction, payer *model.PayerInput) ([]transaction.PayerShare, error) {
	if t.PayerMode != transaction.PayerModeSplit {
		return nil, nil
	}

	if payer != nil && len(payer.Shares) > 0 {
		shares := make([]transaction.PayerShare, 0, len(payer.Shares))
		var sum int64
		for _, si := range payer.Shares {
			if err := requireGroupMember(ctx, s.repositories, t.GroupID, si.UserID); err != nil {
				return nil, err
			}

			amount := 0
			if si.Amount != nil {
				amount = si.Amount.Amount
			}
			share, err := transaction.NewPayerShare(t.ID, si.UserID, int64(amount))
			if err != nil {
				return nil, err
			}
			sum += share.Amount
			shares = append(shares, *share)
		}
		if sum != t.Amount {
			return nil, ErrPayerSharesSumMismatch
		}
		return shares, nil
	}

	members, err := s.repositories.GroupMember.ListByGroup(ctx, t.GroupID)
	if err != nil {
		return nil, fmt.Errorf("list group members for equal split: %w", err)
	}
	if len(members) == 0 {
		return nil, fmt.Errorf("group %s has no members to split between", t.GroupID)
	}

	base := t.Amount / int64(len(members))
	remainder := t.Amount % int64(len(members))
	shares := make([]transaction.PayerShare, 0, len(members))
	for i, m := range members {
		amount := base
		if int64(i) < remainder {
			amount++
		}
		if amount == 0 {
			continue
		}
		share, err := transaction.NewPayerShare(t.ID, m.UserID, amount)
		if err != nil {
			return nil, err
		}
		shares = append(shares, *share)
	}
	return shares, nil
}

// List returns a page of transactions for groupID matching filter, each
// assembled with its category and payer shares.
func (s *TransactionService) List(ctx context.Context, groupID uuid.UUID, filter *model.TransactionFilter, first *int, after *uuid.UUID) (*model.TransactionList, error) {
	var filterDb transaction.Filter
	if filter != nil {
		if filter.Type != nil {
			domainType := mapper.ToDomainTransactionType(*filter.Type)
			filterDb.Type = &domainType
		}
		filterDb.CategoryID = filter.CategoryID
		filterDb.PayerUserID = filter.PayerUserID
		filterDb.RecipientUserID = filter.RecipientUserID
		filterDb.DateFrom = filter.DateFrom
		filterDb.DateTo = filter.DateTo
	}

	pageSize := defaultTransactionPageSize
	if first != nil {
		// A non-positive limit would reach SQL as LIMIT <= 0 (an error), and an
		// unbounded one would let a single request load the whole history.
		pageSize = min(max(*first, 1), maxTransactionPageSize)
	}

	items, hasMore, total, err := s.repositories.Transaction.List(ctx, groupID, filterDb, pageSize, after)
	if err != nil {
		return nil, fmt.Errorf("list transactions: %w", err)
	}

	list := &model.TransactionList{
		Items:   make([]*model.Transaction, 0, len(items)),
		HasMore: hasMore,
		Total:   total,
	}
	for _, t := range items {
		var cat *category.Category
		if t.CategoryID != nil {
			cat, err = s.repositories.Category.GetByID(ctx, t.GroupID, *t.CategoryID)
			if err != nil {
				return nil, fmt.Errorf("load category %s: %w", *t.CategoryID, err)
			}
		}

		shares, err := s.loadShares(ctx, t)
		if err != nil {
			return nil, err
		}

		list.Items = append(list.Items, mapper.ToModelTransaction(&t, mapper.ToModelCategory(cat), shares))
	}
	if hasMore && len(items) > 0 {
		cursor := items[len(items)-1].ID
		list.NextCursor = &cursor
	}
	return list, nil
}

// Get returns a single transaction assembled with its category and payer
// shares, or (nil, nil) if it doesn't exist or doesn't belong to the group.
func (s *TransactionService) Get(ctx context.Context, groupID, transactionID uuid.UUID) (*model.Transaction, error) {
	t, err := s.repositories.Transaction.GetByID(ctx, groupID, transactionID)
	if err != nil {
		if errors.Is(err, transaction.ErrNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("load transaction %s: %w", transactionID, err)
	}

	var cat *category.Category
	if t.CategoryID != nil {
		cat, err = s.repositories.Category.GetByID(ctx, groupID, *t.CategoryID)
		if err != nil {
			return nil, fmt.Errorf("load category %s: %w", *t.CategoryID, err)
		}
	}

	shares, err := s.loadShares(ctx, *t)
	if err != nil {
		return nil, err
	}

	return mapper.ToModelTransaction(t, mapper.ToModelCategory(cat), shares), nil
}

// Delete removes a transaction (its payer shares cascade at the DB level).
func (s *TransactionService) Delete(ctx context.Context, groupID, transactionID uuid.UUID) (bool, error) {
	if err := s.repositories.Transaction.Delete(ctx, groupID, transactionID); err != nil {
		return false, fmt.Errorf("delete transaction %s: %w", transactionID, err)
	}
	return true, nil
}

func (s *TransactionService) loadShares(ctx context.Context, t transaction.Transaction) ([]*model.PayerShare, error) {
	if t.PayerMode != transaction.PayerModeSplit {
		return nil, nil
	}

	domainShares, err := s.repositories.PayerShare.ListByTransaction(ctx, t.ID)
	if err != nil {
		return nil, fmt.Errorf("load payer shares for transaction %s: %w", t.ID, err)
	}
	return mapper.ToModelPayerShares(domainShares), nil
}
