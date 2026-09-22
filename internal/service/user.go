package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/user"
	"OurKoshelechek/internal/mapper"
	"OurKoshelechek/internal/platform"
)

// ErrUsernameTaken is returned by Register when the requested username is
// already in use.
var ErrUsernameTaken = errors.New("username already taken")

// ErrInvalidCredentials is returned by Login for both an unknown username
// and a wrong password, so the response never reveals which one was wrong.
var ErrInvalidCredentials = errors.New("invalid username or password")

// UserService holds the auth/account business logic that resolvers
// previously implemented inline: registering and authenticating users, and
// issuing the access tokens returned as AuthPayload.
type UserService struct {
	repo *user.Repository
	auth *platform.TokenIssuer
}

func NewUserService(repo *user.Repository, auth *platform.TokenIssuer) *UserService {
	return &UserService{repo: repo, auth: auth}
}

func (s *UserService) Register(ctx context.Context, input model.RegisterInput) (*model.AuthPayload, error) {
	if _, err := s.repo.GetByUsername(ctx, input.Username); err == nil {
		return nil, ErrUsernameTaken
	} else if !errors.Is(err, user.ErrNotFound) {
		return nil, fmt.Errorf("check username availability: %w", err)
	}

	now := time.Now()
	u, err := user.NewUser(platform.NewID(), input.Username, input.Password, &now, &now)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Create(ctx, *u); err != nil {
		// Belt-and-suspenders against the GetByUsername check above racing
		// with a concurrent Register for the same username: the DB's unique
		// constraint is the actual source of truth here.
		if errors.Is(err, user.ErrUsernameTaken) {
			return nil, ErrUsernameTaken
		}
		return nil, fmt.Errorf("create user: %w", err)
	}

	return s.issueToken(u.ID)
}

func (s *UserService) Login(ctx context.Context, input model.LoginInput) (*model.AuthPayload, error) {
	u, err := s.repo.GetByUsername(ctx, input.Username)
	if err != nil {
		if errors.Is(err, user.ErrNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("look up user: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword(u.PasswordHash, []byte(input.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return s.issueToken(u.ID)
}

func (s *UserService) Me(ctx context.Context) (*model.User, error) {
	userID, err := platform.CurrentUserID(ctx)
	if err != nil {
		return nil, err
	}

	u, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("load current user: %w", err)
	}
	return mapper.ToModelUser(u), nil
}

func (s *UserService) issueToken(userID uuid.UUID) (*model.AuthPayload, error) {
	accessToken, expiresIn, err := s.auth.Issue(userID)
	if err != nil {
		return nil, fmt.Errorf("issue access token: %w", err)
	}
	return &model.AuthPayload{
		AccessToken: accessToken,
		TokenType:   "Bearer",
		ExpiresIn:   expiresIn,
	}, nil
}
