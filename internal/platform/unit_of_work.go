package platform

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBTX is satisfied by both *pgxpool.Pool and pgx.Tx. Repository constructors
// take a DBTX instead of a *pgxpool.Pool, so the same repository type works
// unmodified whether it's backed by the pool or by a transaction handed out
// by UnitOfWork.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// UnitOfWork opens a transaction and hands it to callers as a DBTX, so
// several repositories built on top of it participate in the same
// transaction, then commits or rolls back as a single unit.
type UnitOfWork struct {
	pool *pgxpool.Pool
}

func NewUnitOfWork(pool *pgxpool.Pool) *UnitOfWork {
	return &UnitOfWork{pool: pool}
}

// Do runs fn inside a transaction. Construct whatever repositories fn needs
// from the db it's given (e.g. budget.New(db)) so they read/write through
// this transaction; commits if fn returns nil, rolls back otherwise
// (including on panic, which is re-thrown after rollback).
func (u *UnitOfWork) Do(ctx context.Context, fn func(db DBTX) error) error {
	tx, err := u.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback(ctx)
			panic(p)
		}
	}()

	if err := fn(tx); err != nil {
		if rbErr := tx.Rollback(ctx); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
			return fmt.Errorf("%w (rollback failed: %v)", err, rbErr)
		}
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}
