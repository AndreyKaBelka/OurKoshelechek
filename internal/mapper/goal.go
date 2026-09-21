package mapper

import (
	"time"

	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/goal"
)

func ToModelGoalType(t goal.Type) model.GoalType {
	switch t {
	case goal.TypeShared:
		return model.GoalTypeShared
	case goal.TypePersonal:
		return model.GoalTypePersonal
	default:
		return ""
	}
}

func ToDomainGoalType(t model.GoalType) goal.Type {
	switch t {
	case model.GoalTypeShared:
		return goal.TypeShared
	case model.GoalTypePersonal:
		return goal.TypePersonal
	default:
		return ""
	}
}

// ToModelGoal принимает currentAmount отдельно: он не хранится в domain.Goal,
// а считается суммой взносов (goal.Contribution) на момент запроса.
func ToModelGoal(g *goal.Goal, currentAmount int64) *model.Goal {
	return &model.Goal{
		ID:            g.ID,
		Name:          g.Name,
		Icon:          g.Icon,
		TargetAmount:  &model.Money{Amount: int(g.TargetAmount)},
		CurrentAmount: &model.Money{Amount: int(currentAmount)},
		Type:          ToModelGoalType(g.Type),
		OwnerUserID:   g.OwnerUserID,
		CreatedAt:     g.CreatedAt,
	}
}

func ToDomainGoal(m *model.Goal, groupID uuid.UUID, updatedAt time.Time) *goal.Goal {
	g := &goal.Goal{
		ID:          m.ID,
		GroupID:     groupID,
		Name:        m.Name,
		Icon:        m.Icon,
		Type:        ToDomainGoalType(m.Type),
		OwnerUserID: m.OwnerUserID,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   updatedAt,
	}
	if m.TargetAmount != nil {
		g.TargetAmount = int64(m.TargetAmount.Amount)
	}
	return g
}

func ToModelGoalContribution(c *goal.Contribution) *model.GoalContribution {
	return &model.GoalContribution{
		ID:     c.ID,
		GoalID: c.GoalID,
		Amount: &model.Money{Amount: int(c.Amount)},
		UserID: c.UserID,
		Date:   c.Date,
	}
}

func ToDomainGoalContribution(m *model.GoalContribution, transactionID *uuid.UUID, createdAt time.Time) *goal.Contribution {
	amount := 0
	if m.Amount != nil {
		amount = m.Amount.Amount
	}
	return &goal.Contribution{
		ID:            m.ID,
		GoalID:        m.GoalID,
		Amount:        int64(amount),
		UserID:        m.UserID,
		Date:          m.Date,
		TransactionID: transactionID,
		CreatedAt:     createdAt,
	}
}
