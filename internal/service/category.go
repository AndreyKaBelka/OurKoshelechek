// Package service holds business logic that resolvers previously
// implemented inline, orchestrating domain packages, repositories and the
// mapper to produce GraphQL-ready results. It sits above internal/domain
// (which stays free of persistence/GraphQL knowledge) so that layer can be
// depended on here without an import cycle through internal/mapper.
package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/category"
	"OurKoshelechek/internal/mapper"
	"OurKoshelechek/internal/platform"
)

// CategoryService holds the category business logic that resolvers
// previously implemented inline: building/validating a Category and
// persisting it.
type CategoryService struct {
	repo *category.Repository
}

func NewCategoryService(repo *category.Repository) *CategoryService {
	return &CategoryService{repo: repo}
}

func (s *CategoryService) Create(ctx context.Context, groupID uuid.UUID, input model.CreateCategoryInput) (*model.Category, error) {
	now := time.Now()
	var monthlyLimit *int
	if input.MonthlyLimit != nil {
		monthlyLimit = &input.MonthlyLimit.Amount
	}

	c, err := category.NewCategory(
		platform.NewID(),
		groupID,
		input.Name,
		input.Icon,
		monthlyLimit,
		&now,
		&now,
	)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Create(ctx, c); err != nil {
		return nil, fmt.Errorf("create category: %w", err)
	}

	return mapper.ToModelCategory(c), nil
}

// Update applies a partial update: fields left nil in input keep the
// category's current value, so e.g. changing only monthlyLimit doesn't wipe
// out name/icon.
func (s *CategoryService) Update(ctx context.Context, groupID, categoryID uuid.UUID, input model.UpdateCategoryInput) (*model.Category, error) {
	existing, err := s.repo.GetByID(ctx, groupID, categoryID)
	if err != nil {
		return nil, fmt.Errorf("load category: %w", err)
	}

	name := existing.Name
	if input.Name != nil {
		name = *input.Name
	}
	icon := existing.Icon
	if input.Icon != nil {
		icon = *input.Icon
	}
	monthlyLimit := existing.MonthlyLimitAmount
	if input.MonthlyLimit != nil {
		monthlyLimit = &input.MonthlyLimit.Amount
	}

	now := time.Now()
	c, err := category.NewCategory(
		categoryID,
		groupID,
		name,
		icon,
		monthlyLimit,
		&existing.CreatedAt,
		&now,
	)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Update(ctx, c); err != nil {
		return nil, fmt.Errorf("update category: %w", err)
	}

	return mapper.ToModelCategory(c), nil
}

func (s *CategoryService) Delete(ctx context.Context, groupID, categoryID uuid.UUID) (bool, error) {
	if err := s.repo.Delete(ctx, groupID, categoryID); err != nil {
		return false, fmt.Errorf("delete category: %w", err)
	}
	return true, nil
}

func (s *CategoryService) List(ctx context.Context, groupID uuid.UUID) ([]*model.Category, error) {
	categories, err := s.repo.ListByGroup(ctx, groupID)
	if err != nil {
		return nil, err
	}

	result := make([]*model.Category, 0, len(categories))
	for _, c := range categories {
		result = append(result, mapper.ToModelCategory(&c))
	}
	return result, nil
}
