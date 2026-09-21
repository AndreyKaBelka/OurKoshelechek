package resolvers

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require
// here.

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"OurKoshelechek/internal/repository"
	"OurKoshelechek/internal/service"
)

// Resolver holds only what resolver bodies and directives genuinely need
// directly. All business logic lives in internal/service/*; resolvers just
// extract request-scoped values (e.g. the current user id) and delegate to
// the matching *Service method.
type Resolver struct {
	// DB is the raw pool, used where a resolver needs infrastructure access
	// that doesn't fit the repository/service layers (currently just the
	// health check).
	DB *pgxpool.Pool
	// Repos is used directly only by the @requireGroupMembership/
	// @requireGroupRole directives (resolvers/directives.go), which are
	// authorization plumbing, not business logic.
	Repos              repository.Repositories
	CategoryService    *service.CategoryService
	TransactionService *service.TransactionService
	UserService        *service.UserService
	GroupService       *service.GroupService
	BudgetService      *service.BudgetService
	GoalService        *service.GoalService
	SummaryService     *service.SummaryService
}
