package mapper

import (
	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/category"
)

func ToModelCategory(c *category.Category) *model.Category {
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

func ToDomainCategory(m *model.Category) *category.Category {
	c := &category.Category{
		ID:   m.ID,
		Icon: m.Icon,
		Name: m.Name,
	}
	if m.MonthlyLimit != nil {
		c.MonthlyLimitAmount = &m.MonthlyLimit.Amount
	}
	return c
}
