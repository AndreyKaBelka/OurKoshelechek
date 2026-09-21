package resolvers

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/group"
	"OurKoshelechek/internal/platform"
)

type fakeMembershipReader struct {
	member *group.Member
	err    error
}

func (f fakeMembershipReader) Get(ctx context.Context, groupID, userID uuid.UUID) (*group.Member, error) {
	return f.member, f.err
}

func ctxWithGroupIDArg(ctx context.Context, groupID uuid.UUID) context.Context {
	return graphql.WithFieldContext(ctx, &graphql.FieldContext{
		Args: map[string]any{"groupId": groupID},
	})
}

func stubNext(called *bool) graphql.Resolver {
	return func(ctx context.Context) (any, error) {
		*called = true
		return "ok", nil
	}
}

func TestRequireGroupMembership(t *testing.T) {
	groupID := uuid.New()
	userID := uuid.New()

	t.Run("unauthenticated fails closed", func(t *testing.T) {
		ctx := ctxWithGroupIDArg(context.Background(), groupID)
		var called bool
		_, err := requireGroupMembership(ctx, fakeMembershipReader{}, stubNext(&called))
		if !errors.Is(err, platform.ErrUnauthenticated) || called {
			t.Fatalf("got err=%v called=%v", err, called)
		}
	})

	t.Run("not a member", func(t *testing.T) {
		ctx := platform.WithUserID(ctxWithGroupIDArg(context.Background(), groupID), userID)
		var called bool
		_, err := requireGroupMembership(ctx, fakeMembershipReader{err: group.ErrMemberNotFound}, stubNext(&called))
		if !errors.Is(err, ErrNotGroupMember) || called {
			t.Fatalf("got err=%v called=%v", err, called)
		}
	})

	t.Run("member passes through", func(t *testing.T) {
		ctx := platform.WithUserID(ctxWithGroupIDArg(context.Background(), groupID), userID)
		var called bool
		m := &group.Member{GroupID: groupID, UserID: userID, Role: group.RoleReader, JoinedAt: time.Now()}
		_, err := requireGroupMembership(ctx, fakeMembershipReader{member: m}, stubNext(&called))
		if err != nil || !called {
			t.Fatalf("got err=%v called=%v", err, called)
		}
	})
}

func TestRequireGroupRole(t *testing.T) {
	groupID, userID := uuid.New(), uuid.New()
	ctx := platform.WithUserID(ctxWithGroupIDArg(context.Background(), groupID), userID)

	t.Run("reader denied edit-rights field", func(t *testing.T) {
		var called bool
		m := &group.Member{GroupID: groupID, UserID: userID, Role: group.RoleReader}
		_, err := requireGroupRole(ctx, fakeMembershipReader{member: m}, stubNext(&called), model.GroupRoleMember)
		if !errors.Is(err, ErrInsufficientGroupRole) || called {
			t.Fatalf("got err=%v called=%v", err, called)
		}
	})

	t.Run("member allowed", func(t *testing.T) {
		var called bool
		m := &group.Member{GroupID: groupID, UserID: userID, Role: group.RoleMember}
		_, err := requireGroupRole(ctx, fakeMembershipReader{member: m}, stubNext(&called), model.GroupRoleMember)
		if err != nil || !called {
			t.Fatalf("got err=%v called=%v", err, called)
		}
	})

	t.Run("unauthenticated fails closed", func(t *testing.T) {
		anonCtx := ctxWithGroupIDArg(context.Background(), groupID)
		var called bool
		_, err := requireGroupRole(anonCtx, fakeMembershipReader{}, stubNext(&called), model.GroupRoleMember)
		if !errors.Is(err, platform.ErrUnauthenticated) || called {
			t.Fatalf("got err=%v called=%v", err, called)
		}
	})
}
