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

// ToDomainGoal строит и валидирует Goal через goal.NewGoal, так что доменные
// инварианты (непустое имя, сумма цели > 0, владелец для personal-целей и
// т.д.) всегда проверяются.
func ToDomainGoal(m *model.Goal, groupID uuid.UUID, updatedAt time.Time) (*goal.Goal, error) {
	amount := 0
	if m.TargetAmount != nil {
		amount = m.TargetAmount.Amount
	}
	return goal.NewGoal(m.ID, groupID, m.Name, m.Icon, int64(amount), ToDomainGoalType(m.Type), m.OwnerUserID, m.CreatedAt, updatedAt)
}

func ToModelGoalContribution(c *goal.Contribution) *model.GoalContribution {
	return &model.GoalContribution{
		ID:     c.ID,
		GoalID: c.GoalID,
		Amount: &model.Money{Amount: int(c.Amount)},
		Date:   c.Date,
	}
}
