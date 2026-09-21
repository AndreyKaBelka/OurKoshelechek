package platform

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

// ErrUnauthenticated возвращается CurrentUserID, если в ctx нет
// аутентифицированного пользователя. Вызывающий код (директивы) должен
// трактовать это как fail-closed отказ авторизации.
var ErrUnauthenticated = errors.New("no authenticated user in context")

type ctxKeyUserID struct{}

// WithUserID кладёт userID как аутентифицированного пользователя в ctx.
// Вызывается HTTP-слоем аутентификации после проверки токена/сессии —
// сам этот механизм пока не реализован, см. cmd/app/main.go.
func WithUserID(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, ctxKeyUserID{}, userID)
}

// CurrentUserID достаёт ID аутентифицированного пользователя из ctx,
// либо возвращает ErrUnauthenticated.
func CurrentUserID(ctx context.Context) (uuid.UUID, error) {
	id, ok := ctx.Value(ctxKeyUserID{}).(uuid.UUID)
	if !ok {
		return uuid.UUID{}, ErrUnauthenticated
	}
	return id, nil
}
