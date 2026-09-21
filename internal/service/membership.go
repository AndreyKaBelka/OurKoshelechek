package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"OurKoshelechek/internal/domain/group"
	"OurKoshelechek/internal/repository"
)

// ErrUserNotGroupMember is returned when an input user id (payer, budget
// split participant, goal owner/contributor, ...) doesn't belong to the
// group the action is scoped to.
var ErrUserNotGroupMember = errors.New("user is not a member of this group")

// requireGroupMember checks that userID is a member of groupID, translating
// group.ErrMemberNotFound into the service-level ErrUserNotGroupMember so
// mutations can't be used to act on behalf of an outsider.
func requireGroupMember(ctx context.Context, repos *repository.Repositories, groupID, userID uuid.UUID) error {
	if _, err := repos.GroupMember.Get(ctx, groupID, userID); err != nil {
		if errors.Is(err, group.ErrMemberNotFound) {
			return ErrUserNotGroupMember
		}
		return fmt.Errorf("check group membership for user %s: %w", userID, err)
	}
	return nil
}
