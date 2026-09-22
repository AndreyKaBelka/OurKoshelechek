package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/category"
	"OurKoshelechek/internal/domain/goal"
	"OurKoshelechek/internal/domain/transaction"
	"OurKoshelechek/internal/mapper"
	"OurKoshelechek/internal/platform"
	"OurKoshelechek/internal/repository"
)

// savingsCategoryName/Icon identify the well-known category that goal
// contributions post their expense transaction against; it's created lazily
// on the group's first contribution if it doesn't exist yet.
const (
	savingsCategoryName = "Накопления"
	savingsCategoryIcon = "💰"
)

// ErrContributionNotFromOwner is returned by Contribute when the
// contributing user isn't the owner of a PERSONAL goal.
var ErrContributionNotFromOwner = errors.New("contribution to a personal goal must come from its owner")

// GoalService holds the savings-goal business logic that resolvers
// previously implemented inline: building/validating a Goal, and, for
// contributions, atomically posting the matching expense transaction
// alongside the contribution record.
type GoalService struct {
	repositories *repository.Repositories
	uow          *platform.UnitOfWork
}

func NewGoalService(repositories *repository.Repositories, uow *platform.UnitOfWork) *GoalService {
	return &GoalService{repositories: repositories, uow: uow}
}

func (s *GoalService) Create(ctx context.Context, groupID uuid.UUID, input model.CreateGoalInput) (*model.Goal, error) {
	createdBy, err := platform.CurrentUserID(ctx)
	if err != nil {
		return nil, err
	}

	goalType := mapper.ToDomainGoalType(input.Type)
	var ownerUserID *uuid.UUID
	if goalType == goal.TypePersonal {
		ownerUserID = &createdBy
	}

	amount := 0
	if input.TargetAmount != nil {
		amount = input.TargetAmount.Amount
	}

	now := time.Now()
	g, err := goal.NewGoal(platform.NewID(), groupID, input.Name, input.Icon, int64(amount), goalType, ownerUserID, now, now)
	if err != nil {
		return nil, err
	}

	if err := s.repositories.Goal.Create(ctx, *g); err != nil {
		return nil, fmt.Errorf("create goal: %w", err)
	}

	return mapper.ToModelGoal(g, 0), nil
}

// Update applies a partial update (Type and OwnerUserID are immutable and
// always carried over from the existing goal).
func (s *GoalService) Update(ctx context.Context, groupID, goalID uuid.UUID, input model.UpdateGoalInput) (*model.Goal, error) {
	existing, err := s.repositories.Goal.GetByID(ctx, groupID, goalID)
	if err != nil {
		return nil, fmt.Errorf("load goal %s: %w", goalID, err)
	}

	name := existing.Name
	if input.Name != nil {
		name = *input.Name
	}
	icon := existing.Icon
	if input.Icon != nil {
		icon = input.Icon
	}
	targetAmount := existing.TargetAmount
	if input.TargetAmount != nil {
		targetAmount = int64(input.TargetAmount.Amount)
	}

	g, err := goal.NewGoal(goalID, groupID, name, icon, targetAmount, existing.Type, existing.OwnerUserID, existing.CreatedAt, time.Now())
	if err != nil {
		return nil, err
	}

	if err := s.repositories.Goal.Update(ctx, *g); err != nil {
		return nil, fmt.Errorf("update goal: %w", err)
	}

	current, err := s.repositories.Contribution.SumByGoal(ctx, goalID)
	if err != nil {
		return nil, err
	}

	return mapper.ToModelGoal(g, current), nil
}

func (s *GoalService) Delete(ctx context.Context, groupID, goalID uuid.UUID) (bool, error) {
	if err := s.repositories.Goal.Delete(ctx, groupID, goalID); err != nil {
		return false, fmt.Errorf("delete goal %s: %w", goalID, err)
	}
	return true, nil
}

// Contribute validates the contribution, finds or lazily creates the
// group's savings category, and atomically persists the expense
// transaction and the contribution record.
func (s *GoalService) Contribute(ctx context.Context, groupID, goalID uuid.UUID, input model.ContributeGoalInput) (*model.GoalContribution, error) {
	createdBy, err := platform.CurrentUserID(ctx)
	if err != nil {
		return nil, err
	}

	g, err := s.repositories.Goal.GetByID(ctx, groupID, goalID)
	if err != nil {
		return nil, fmt.Errorf("load goal %s: %w", goalID, err)
	}
	if g.Type == goal.TypePersonal && g.OwnerUserID != nil && *g.OwnerUserID != createdBy {
		return nil, ErrContributionNotFromOwner
	}

	// Find or atomically create the group's savings category. GetOrCreate is
	// backed by a unique (group_id, name) index, so concurrent first
	// contributions to the same group can't race into duplicate categories
	// the way a GetByName-then-Create check would.
	catNow := time.Now()
	candidate, err := category.NewCategory(platform.NewID(), groupID, savingsCategoryName, savingsCategoryIcon, nil, &catNow, &catNow)
	if err != nil {
		return nil, err
	}
	cat, err := s.repositories.Category.GetOrCreate(ctx, candidate)
	if err != nil {
		return nil, fmt.Errorf("get or create savings category: %w", err)
	}

	amount := 0
	if input.Amount != nil {
		amount = input.Amount.Amount
	}
	date := time.Now()
	if input.Date != nil {
		date = *input.Date
	}

	now := time.Now()
	tx, err := transaction.NewTransaction(platform.NewID(), groupID, transaction.TypeExpense, int64(amount), &cat.ID, transaction.PayerModeUser, &createdBy, date, nil, createdBy, now, now)
	if err != nil {
		return nil, err
	}

	c, err := goal.NewContribution(platform.NewID(), goalID, int64(amount), createdBy, date, &tx.ID, now)
	if err != nil {
		return nil, err
	}

	err = repository.RunInTx(ctx, s.uow, func(repos repository.Repositories) error {
		if err := repos.Transaction.Create(ctx, *tx); err != nil {
			return fmt.Errorf("create contribution transaction: %w", err)
		}
		if err := repos.Contribution.Create(ctx, *c); err != nil {
			return fmt.Errorf("create goal contribution: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return mapper.ToModelGoalContribution(c), nil
}

// List returns the group's SHARED goals plus PERSONAL goals owned by the
// current user; other members' PERSONAL goals are never visible.
func (s *GoalService) List(ctx context.Context, groupID uuid.UUID) ([]*model.Goal, error) {
	currentUserID, err := platform.CurrentUserID(ctx)
	if err != nil {
		return nil, fmt.Errorf("current user id: %w", err)
	}

	goals, err := s.repositories.Goal.ListByGroup(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("list goals: %w", err)
	}

	result := make([]*model.Goal, 0, len(goals))
	for i := range goals {
		if goals[i].Type == goal.TypePersonal && (goals[i].OwnerUserID == nil || *goals[i].OwnerUserID != currentUserID) {
			continue
		}
		current, err := s.repositories.Contribution.SumByGoal(ctx, goals[i].ID)
		if err != nil {
			return nil, err
		}
		result = append(result, mapper.ToModelGoal(&goals[i], current))
	}
	return result, nil
}

func (s *GoalService) ListContributions(ctx context.Context, groupID, goalID uuid.UUID) ([]*model.GoalContribution, error) {
	goalDB, err := s.repositories.Goal.GetByID(ctx, groupID, goalID)
	if err != nil {
		return nil, fmt.Errorf("load goal %s: %w", goalID, err)
	}

	currentUserId, err := platform.CurrentUserID(ctx)
	if err != nil {
		return nil, fmt.Errorf("current user id: %w", err)
	}

	if goalDB.Type == goal.TypePersonal && goalDB.OwnerUserID != nil && *goalDB.OwnerUserID != currentUserId {
		return nil, ErrContributionNotFromOwner
	}

	contributions, err := s.repositories.Contribution.ListByGoal(ctx, goalID)
	if err != nil {
		return nil, fmt.Errorf("list goal contributions: %w", err)
	}

	result := make([]*model.GoalContribution, 0, len(contributions))
	for i := range contributions {
		result = append(result, mapper.ToModelGoalContribution(&contributions[i]))
	}
	return result, nil
}
