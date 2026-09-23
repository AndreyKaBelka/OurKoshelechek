// Package repository bundles the domain repositories into a single set,
// constructed once per DB handle (pool or transaction) instead of once per
// call site.
package repository

import (
	"context"

	"OurKoshelechek/internal/domain/category"
	"OurKoshelechek/internal/domain/goal"
	"OurKoshelechek/internal/domain/group"
	"OurKoshelechek/internal/domain/refreshtoken"
	"OurKoshelechek/internal/domain/transaction"
	"OurKoshelechek/internal/domain/user"
	"OurKoshelechek/internal/platform"
)

type Repositories struct {
	User         *user.Repository
	Group        *group.Repository
	GroupMember  *group.MemberRepository
	GroupInvite  *group.InviteRepository
	Category     *category.Repository
	Transaction  *transaction.Repository
	PayerShare   *transaction.PayerShareRepository
	Goal         *goal.Repository
	Contribution *goal.ContributionRepository
	RefreshToken *refreshtoken.Repository
}

func New(db platform.DBTX) Repositories {
	return Repositories{
		User:         user.New(db),
		Group:        group.New(db),
		GroupMember:  group.NewMemberRepository(db),
		GroupInvite:  group.NewInviteRepository(db),
		Category:     category.New(db),
		Transaction:  transaction.New(db),
		PayerShare:   transaction.NewPayerShareRepository(db),
		Goal:         goal.New(db),
		Contribution: goal.NewContributionRepository(db),
		RefreshToken: refreshtoken.New(db),
	}
}

// RunInTx runs fn against Repositories bound to a transaction opened by uow,
// committing on success and rolling back on error or panic.
func RunInTx(ctx context.Context, uow *platform.UnitOfWork, fn func(Repositories) error) error {
	return uow.Do(ctx, func(db platform.DBTX) error {
		return fn(New(db))
	})
}
