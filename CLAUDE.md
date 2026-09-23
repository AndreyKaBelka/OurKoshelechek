# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
It is a **router**: it says how to work and which file in `context/` to read for which task.
The details live in `context/` — read only the files the current task needs.

## Project

"Вдвоём" (OurKoshelechek) — a shared-budget app for couples/groups (N ≥ 2 members):
shared transactions, per-category budgets, expense-split between members, transfers, and
savings goals. Schema-first GraphQL backend (Go + gqlgen + Postgres, repo root) plus a
React/Vite/urql frontend (`frontend/`). Money is always integer kopecks.

## Context routing

Always read first: `context/operator-profile.md`, `context/principles.md`.

| Task | Read |
|---|---|
| Backend change (resolver, service, domain, repository) | `context/architecture.md`, `context/decision-rules.md` |
| GraphQL schema / API contract change | `context/architecture.md`, `context/decision-rules.md`, `context/product-and-users.md` |
| DB migration, constraints, FK | `context/decision-rules.md`, `context/lessons-learned.md`, `context/deploy-and-ops.md` |
| New feature / product question / "what's next" | `context/product-and-users.md`, `context/project-context.md` |
| Financial model (income, budget, split, transfers, goals) | `context/product-and-users.md`, `context/decision-rules.md`, `context/lessons-learned.md` |
| Frontend screen / UI copy | `context/code-and-ui-style.md`, `context/product-and-users.md`, `context/architecture.md` (Frontend) |
| Bug hunt / debugging | `context/lessons-learned.md`, `context/architecture.md` |
| Docker, CI, deploy, env vars, backups | `context/deploy-and-ops.md` |
| Delegating to subagents | paste the relevant parts of `context/principles.md` into the prompt |

## Keeping context fresh

Update `context/` from real friction, not on a schedule:
- finished or started a task → update statuses in `context/project-context.md` (✅ + what was done);
- hit a pitfall or got corrected by the owner → add *symptom → cause → rule* to `context/lessons-learned.md`;
- a product decision was made → `context/product-and-users.md`; a new invariant → `context/principles.md`;
- architecture/infra changed → `context/architecture.md` / `context/deploy-and-ops.md`.
Keep each file short (≈100 lines); link to code instead of copying it.

## Commands

```sh
make generate        # regenerate graph/generated.go, graph/model, resolver stubs from api/**/*.graphql
make build            # go build -o bin/ourkoshelechek ./cmd/app
make run              # go run ./cmd/app
make fmt              # gofmt -l -w .
make vet              # go vet ./...
make lint             # golangci-lint run ./... (defaults, no .golangci.yml)
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

Frontend (run from `frontend/`):

```sh
npm run dev       # vite dev server
npm run build     # tsc -b && vite build
npm run lint      # oxlint
npm run codegen   # regenerate src/graphql/types.ts and *.generated.ts from api/**/*.graphql + src/**/*.graphql
```

`docker-compose.yml` runs Postgres + migrations + app + frontend + backups locally;
`.env.example` lists the env vars. `JWT_SECRET` must be set outside local dev.
Push to `master` deploys to production (see `context/deploy-and-ops.md`).
