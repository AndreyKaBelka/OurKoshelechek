# Architecture

Read before touching backend layers, the GraphQL schema, migrations or frontend
structure. Invariants that must never be broken are summarized in `principles.md`.

## Backend

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
  is where app-wide dependencies (DB pool, config, services) are injected.

Money is always an integer amount in minimal currency units (kopecks), see the `Money`/
`MoneyInput` GraphQL types and the `*_amount`/`Amount` int64 fields throughout.

**Domain layer (`internal/domain/<name>/`)** — one package per business entity (`user`,
`group`, `category`, `transaction`, `budget`, `goal`, `refreshtoken`). Each holds plain
structs, a `New<Entity>(...)` constructor that validates and returns sentinel `Err*`
values (e.g. `user.ErrUsernameTooLong`, `category.ErrInvalidMonthlyLimitAmount`), and a
`Repository` (plus extra repositories where an entity needs more than CRUD, e.g.
`group.MemberRepository`/`group.InviteRepository`, `transaction.PayerShareRepository`,
`goal.ContributionRepository`). Repositories are pgx-based (no ORM), take a
`platform.DBTX` (satisfied by both `*pgxpool.Pool` and `pgx.Tx`) instead of a concrete
pool, and translate `pgx.ErrNoRows` into a package-level `ErrNotFound`-style sentinel.
Domain structs must always be built through their `New<Entity>(...)` constructor, never
via a raw struct literal outside the domain package itself.

**`internal/repository/`** (`Repositories` struct, built by `repository.New(db)`) bundles
one instance of every domain repository. `repository.RunInTx(ctx, uow, fn)` builds a
`Repositories` bound to a transaction so multiple repositories share one unit of work.

**`internal/service/`** — one file per domain area holding the business logic
(validation beyond the domain constructor, orchestrating multiple repositories, issuing
auth tokens, transactions via `internal/platform.UnitOfWork`). `membership.go` has the
shared `requireGroupMember` helper. Resolvers depend on services, not repositories (sole
exception: the directives in `resolvers/directives.go`, which read
`Resolver.Repos.GroupMember` directly — authorization plumbing, not business logic).

**`internal/mapper/`** — pure functions converting between `graph/model` and
`internal/domain/<name>` types (`ToModelUser`/`ToDomainUser`, …). Every `ToDomain*`
mapper goes through the domain `New<Entity>(...)` constructor (returning its `error`).

**`internal/platform/`** — cross-cutting infrastructure: `NewPG(connString)` (pgxpool),
`UnitOfWork`/`DBTX`, `NewID()` (UUIDv7 — time-ordered ids for every created entity),
`TokenIssuer` (HS256 JWT access tokens, 15 min, keyed by `JWT_SECRET`, insecure dev
default with a loud warning if unset), `WithUserID`/`CurrentUserID` (request-scoped auth
context; `ErrUnauthenticated` if nothing was authenticated).

**Refresh tokens** (`internal/domain/refreshtoken`, table `refresh_tokens`) are opaque
random strings returned as `AuthPayload.refreshToken` (only their SHA-256 hash is stored,
TTL 30 days). Single-use: the `refreshToken` mutation atomically revokes the presented one
and issues a new pair; `logout` revokes it. The lifetime is sliding: every rotation issues a
token with a fresh 30 days, and the client rotates on every app launch (first request of a page
load, `willAuthError` in `client.ts`) as well as whenever the 15-min access token expires — so
the user is logged out only after 30 days without opening the app. Auth failures carry
`extensions.code = "UNAUTHENTICATED"` (`presentError` in `cmd/app/main.go`).

**Authorization** — two directives declared in `api/schema.graphql`, implemented in
`resolvers/directives.go`: `@requireGroupMembership` (authenticated member of the group
named by the field's `groupId: UUID!` arg, any role) and `@requireGroupRole(min:
GroupRole!)` (role at least `min`; `group.Role.AtLeast` orders `OWNER > MEMBER > READER`).

**`cmd/app/main.go`** boots Postgres, builds the service graph, and wraps `/query` in JWT
middleware reading `Authorization: Bearer <token>`; a missing/invalid header just leaves
the request unauthenticated — failure is enforced downstream (directives, services).

**`db/migrations/`** — goose SQL migrations: `users`, `groups`/`group_members`/
`group_invites`, `categories` (unique `(group_id, name)`), `transactions` (`type`
`income|expense|transfer`, `payer_mode` `user|split`, nullable `category_id`,
`recipient_user_id` for transfers) + `transaction_payer_shares`, goals/contributions,
`refresh_tokens`. The schema is the authoritative source for relationships and enum values
(`group_role`, `group_invite_status`, `transaction_type`, `payer_mode`).

## Frontend (`frontend/`)

React + TypeScript + Vite, `urql` client (`src/main.tsx`: `urqlClient` from
`src/graphql/client.ts` wrapped around `AppStoreProvider` from `src/store/store.tsx`).
The urql `authExchange` refreshes the access token on `UNAUTHENTICATED` and retries;
session storage lives in `src/graphql/session.ts`.

- `src/graphql/operations/*.graphql` — one file per domain area, mirroring `api/`. Each
  has a colocated `*.generated.ts` from `npm run codegen`, which reads the backend's
  `api/**/*.graphql` directly (no schema copy). Re-run codegen after any schema/operation
  change.
- `src/screens/` — Auth, Overview, Transactions, Budget, Goals, Group.
- `src/store/store.tsx` — app-wide client state (session, active group).
- `src/components/` — Avatar, BottomSheet, TabBar, InstallBanner.
- `src/lib/` — `money.ts` (kopecks ↔ roubles), `period.ts`, `txDisplay.ts`, `icons.tsx`.

The frontend itself is the reference implementation of the UI (no mockups directory).
