package mapper

import (
	"time"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/user"
)

func ToModelUser(u *user.User) *model.User {
	return &model.User{
		ID:       u.ID,
		Username: u.Username,
	}
}

// ToDomainUser строит и валидирует User через user.NewUser, так что доменные
// инварианты (длина username, хэширование пароля и т.д.) всегда проверяются.
func ToDomainUser(m *model.User, password string, createdAt, updatedAt *time.Time) (*user.User, error) {
	return user.NewUser(m.ID, m.Username, password, createdAt, updatedAt)
}
