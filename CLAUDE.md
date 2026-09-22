# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Вдвоём" (OurKoshelechek) — a shared-budget app for couples/groups (N ≥ 2 members):
shared transactions, per-category budgets, expense-split between members, and savings
goals. It's a GraphQL backend (Go, this repo's root) plus a React frontend
(`frontend/`, see below). Business context and open product questions live in
`docs/BUSINESS_OVERVIEW.md`; a draft REST-style endpoint catalog (predates the move to
GraphQL, kept as a functional checklist) is in `docs/API_TODO.md`.

## Commands

```sh
make generate        # regenerate graph/generated.go, graph/model, resolver stubs from api/**/*.graphql
make build            # go build -o bin/ourkoshelechek ./cmd/app
make run              # go run ./cmd/app
make fmt              # gofmt -l -w .
make vet              # go vet ./...
make lint             # golangci-lint run ./...
make test             # go test ./...
go test ./internal/domain/user/...             # single package
go test ./internal/domain/user/ -run TestName  # single test
```

Database (goose migrations, `db/migrations/`, DSN via `DB_DSN` or `.env`):

```sh
make migrate-up
make migrate-down
make migrate-status
make migrate-create name=<migration_name>
```

`docker-compose.yml` runs Postgres + the app together; `.env.example` lists the env vars
(`POSTGRES_*`, `PORT`, `JWT_SECRET`). `DB_DSN` defaults to
`postgres://postgres:postgres@localhost:5432/ourkoshelechek?sslmode=disable`. `JWT_SECRET`
signs access tokens (HS256); if unset, `cmd/app/main.go` falls back to an insecure
hardcoded dev secret and logs a warning — always set it outside local dev.

There is no `.golangci.yml` yet, so `make lint` uses golangci-lint defaults.

Frontend (run from `frontend/`):

```sh
npm run dev       # vite dev server
npm run build     # tsc -b && vite build
npm run lint       # oxlint
npm run codegen    # graphql-codegen --config codegen.ts (regenerates src/graphql/types.ts
                    # and per-operation *.generated.ts from api/**/*.graphql + src/**/*.graphql)
```

`docker-compose.yml`'s `frontend` service builds `frontend/Dockerfile` (nginx serving the
Vite build) with `VITE_API_URL` baked in at build time (`FRONTEND_API_URL` env var,
default `/query`, proxied to the `app` service by `frontend/nginx.conf`).

## Architecture

**Schema-first GraphQL via gqlgen.** The source of truth is `api/**/*.graphql`, one file
per domain area (`api/user`, `api/groups`, `api/categories`, `api/transactions`,
`api/budget`, `api/goals`, `api/summary`, `api/health`), plus shared scalars in
`api/schema.graphql` and the root `type Query`/`type Mutation` in `api/root.graphql`.
Running `make generate` (gqlgen, configured in `gqlgen.yml`) regenerates:

- `graph/generated.go` — the executable schema (never hand-edit).
- `graph/model/models_gen.go` — Go types for GraphQL inputs/types (never hand-edit).
- `resolvers/*.resolvers.go` — one file per schema file (`follow-schema` layout). gqlgen
  only appends new resolver stubs and preserves hand-written method bodies on
  regeneration; `resolvers/resolver.go` (the `Resolver` struct) is never regenerated and
  is where app-wide dependencies (DB pool, config, services) should be injected.

Money is always an integer amount in minimal currency units (kopecks), see the `Money`/
`MoneyInput` GraphQL types and the `*_amount`/`Amount` int64 fields throughout.

**Domain layer (`internal/domain/<name>/`)** — one package per business entity (`user`,
`group`, `category`, `transaction`, `budget`, `goal`). Each holds plain structs, a
`New<Entity>(...)` constructor that validates and returns sentinel `Err*` values (e.g.
`user.ErrUsernameTooLong`, `category.ErrInvalidMonthlyLimitAmount`), and a `Repository`
(plus extra repositories where an entity needs more than CRUD, e.g.
`group.MemberRepository`/`group.InviteRepository`, `transaction.PayerShareRepository`,
`goal.ContributionRepository`). Repositories are pgx-based (no ORM), take a
`platform.DBTX` (satisfied by both `*pgxpool.Pool` and `pgx.Tx`) instead of a concrete
pool, and translate `pgx.ErrNoRows` into a package-level `ErrNotFound`-style sentinel.
Domain structs must always be built through their `New<Entity>(...)` constructor, never
via a raw struct literal outside the domain package itself — the constructor is where all
validation of that entity's invariants lives, so bypassing it (e.g. in `internal/mapper`
or `internal/service`) silently skips validation and lets invalid entities reach the DB.

**`internal/repository/`** (`Repositories` struct, built by `repository.New(db)`) bundles
one instance of every domain repository behind a single value, constructed once per DB
handle. `repository.RunInTx(ctx, uow, fn)` builds a `Repositories` bound to a transaction
so multiple repositories participate in the same unit of work.

**`internal/service/`** — one file per domain area holding the business logic that used
to live inline in resolvers (validation beyond what the domain constructor does,
orchestrating multiple repositories, issuing auth tokens, transaction handling via
`internal/platform.UnitOfWork`). Resolvers depend on services, not repositories directly
(the sole exception being the `@requireGroupMembership`/`@requireGroupRole` directives in
`resolvers/directives.go`, which read `Resolver.Repos.GroupMember` directly since they're
authorization plumbing, not business logic).

**`internal/mapper/`** — pure functions converting between `graph/model` (GraphQL) types
and `internal/domain/<name>` types (`ToModelUser`/`ToDomainUser` and friends). Every
`ToDomain*` mapper must go through the target domain type's `New<Entity>(...)`
constructor (returning its `error`) instead of building the struct literal directly, so
GraphQL input always passes through the same validation as any other caller.

**`internal/platform/`** holds cross-cutting infrastructure:
`NewPG(connString)` (builds the `pgxpool.Pool`), `UnitOfWork`/`DBTX` (transaction
plumbing shared by repositories, see above), `TokenIssuer` (issues/parses the HS256 JWTs
returned as `AuthPayload.accessToken`, keyed by the `JWT_SECRET` env var — falls back to
an insecure dev default with a loud warning if unset), and `WithUserID`/`CurrentUserID`
(request-scoped auth context; `ErrUnauthenticated` if nothing was authenticated).

**Authorization** is enforced via two custom GraphQL directives declared in
`api/schema.graphql` and implemented in `resolvers/directives.go`:
`@requireGroupMembership` (caller must be an authenticated member of the group named by
the field's `groupId: UUID!` arg, any role) and `@requireGroupRole(min: GroupRole!)` (same,
but with role at least `min`; `group.Role.AtLeast` orders `OWNER > MEMBER > READER`).

**`db/migrations/`** — goose SQL migrations (`<timestamp>_init_db.sql` so far) defining
`users`, `groups`/`group_members`/`group_invites`, `categories`, `transactions` (with a
`payer_mode` of `user` vs `split` and a `transaction_payer_shares`-style split table),
budget splits, and goals/contributions. This schema is the most current/authoritative
source for entity relationships and enum values (`group_role`, `group_invite_status`,
`transaction_type`, `payer_mode`) — check it before assuming a domain struct's shape.

**Current implementation state:** resolvers are implemented (not stubs) and delegate to
`internal/service`; `resolvers/resolver.go`'s `Resolver` is wired with the DB pool, all
repositories, and every service. `cmd/app/main.go` boots Postgres (`platform.NewPG`),
builds the service graph, and wraps `/query` in JWT auth middleware that reads
`Authorization: Bearer <token>` and puts the user id on the request context
(`platform.WithUserID`) when the token is valid — a missing/invalid header just leaves the
request unauthenticated, so failure is enforced downstream (directives, services) rather
than at the middleware. When implementing or changing a resolver, the flow is: read the
corresponding `.graphql` file for the contract, extend the matching
`internal/domain/<name>` package (struct/constructor/repository) if needed, put business
logic in the matching `internal/service` file, and keep the resolver body a thin
delegation plus `internal/mapper` conversions.

## Frontend (`frontend/`)

React + TypeScript + Vite, using `urql` as the GraphQL client (see `frontend/src/main.tsx`
for provider setup: `urqlClient` from `src/graphql/client`, wrapped around an
`AppStoreProvider` from `src/store/store.tsx`). Structure:

- `src/graphql/operations/*.graphql` — one file per domain area (auth, groups,
  categories, transactions, budget, goals, summary, health), mirroring the backend's
  `api/**/*.graphql` split. Each has a colocated `*.generated.ts` produced by
  `npm run codegen`, which points `graphql-codegen` (`frontend/codegen.ts`) directly at
  the backend's `api/**/*.graphql` schema — the frontend has no separate schema copy.
  Re-run codegen after adding/editing an operation or after the backend schema changes.
- `src/screens/` — one component per top-level screen (Auth, Overview, Transactions,
  Budget, Goals, Group).
- `src/store/store.tsx` — app-wide client state (auth/session, etc.) via context.
- `src/components/` — shared UI pieces (Avatar, BottomSheet, TabBar, InstallBanner).
- `src/lib/` — helpers (`money.ts` for the same minimal-unit integer amounts the backend
  uses, `period.ts`, `txDisplay.ts`, `icons.tsx`).

There is no separate `design/*.html` mockup directory anymore — the frontend itself is now
the reference implementation of the UI.
