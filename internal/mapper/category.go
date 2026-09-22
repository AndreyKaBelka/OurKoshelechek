package mapper

import (
	"time"

	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/category"
)

func ToModelCategory(c *category.Category) *model.Category {
	if c == nil {
		return nil
	}
	m := &model.Category{
		ID:   c.ID,
		Icon: c.Icon,
		Name: c.Name,
	}
	if c.MonthlyLimitAmount != nil {
		m.MonthlyLimit = &model.Money{Amount: *c.MonthlyLimitAmount}
	}
	return m
}

// ToDomainCategory строит и валидирует Category через category.NewCategory,
// так что доменные инварианты (непустое/не слишком длинное имя, лимит > 0
// и т.д.) всегда проверяются.
func ToDomainCategory(m *model.Category, groupID uuid.UUID, createdAt, updatedAt *time.Time) (*category.Category, error) {
	var monthlyLimit *int
	if m.MonthlyLimit != nil {
		monthlyLimit = &m.MonthlyLimit.Amount
	}
	return category.NewCategory(m.ID, groupID, m.Name, m.Icon, monthlyLimit, createdAt, updatedAt)
}
