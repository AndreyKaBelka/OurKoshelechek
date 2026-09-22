package main

import (
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"OurKoshelechek/graph"
	"OurKoshelechek/internal/platform"
	"OurKoshelechek/internal/repository"
	"OurKoshelechek/internal/service"
	"OurKoshelechek/resolvers"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/vektah/gqlparser/v2/ast"
)

const defaultPort = "8081"
const defaultDBDSN = "postgres://postgres:postgres@localhost:5432/ourkoshelechek?sslmode=disable"

// devJWTSecret is used only when JWT_SECRET isn't set, so a fresh dev
// environment still boots; run() logs loudly when it falls back to this.
const devJWTSecret = "dev-insecure-secret-change-me"

const accessTokenTTL = 24 * time.Hour

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	if err := run(log); err != nil {
		log.Error("fatal error", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	dbDSN := os.Getenv("DB_DSN")
	if dbDSN == "" {
		dbDSN = defaultDBDSN
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Warn("JWT_SECRET not set, falling back to an insecure development secret")
		jwtSecret = devJWTSecret
	}

	pool, err := platform.NewPG(dbDSN)
	if err != nil {
		return err
	}
	defer pool.Close()

	repos := repository.New(pool)
	uow := platform.NewUnitOfWork(pool)
	auth := platform.NewTokenIssuer([]byte(jwtSecret), accessTokenTTL)
	resolver := &resolvers.Resolver{
		DB:                 pool,
		Repos:              repos,
		CategoryService:    service.NewCategoryService(repos.Category),
		TransactionService: service.NewTransactionService(&repos, uow),
		UserService:        service.NewUserService(repos.User, auth),
		GroupService:       service.NewGroupService(&repos, uow),
		BudgetService:      service.NewBudgetService(&repos),
		GoalService:        service.NewGoalService(&repos, uow),
		SummaryService:     service.NewSummaryService(repos.Transaction),
	}

	srv := handler.New(graph.NewExecutableSchema(graph.Config{
		Resolvers: resolver,
		Directives: graph.DirectiveRoot{
			RequireGroupMembership: resolver.RequireGroupMembership,
			RequireGroupRole:       resolver.RequireGroupRole,
		},
	}))

	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.POST{})

	srv.SetQueryCache(lru.New[*ast.QueryDocument](1000))

	srv.Use(extension.Introspection{})
	srv.Use(extension.AutomaticPersistedQuery{
		Cache: lru.New[string](100),
	})

	mux := http.NewServeMux()
	mux.Handle("/", playground.Handler("GraphQL playground", "/query"))
	mux.Handle("/query", authMiddleware(auth, srv))

	log.Info("starting server", "port", port)

	return http.ListenAndServe(":"+port, mux)
}

// authMiddleware reads Authorization: Bearer <token> off the request, and
// when present and valid, puts the user id in the request context via
// platform.WithUserID so platform.CurrentUserID and the @requireGroup*
// directives see it. A missing or invalid header is not itself an error
// here — it just leaves the request unauthenticated, and resolvers/
// directives that need a user reject it themselves.
func authMiddleware(auth *platform.TokenIssuer, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if ok {
			if userID, err := auth.Parse(token); err == nil {
				r = r.WithContext(platform.WithUserID(r.Context(), userID))
			}
		}
		next.ServeHTTP(w, r)
	})
}
