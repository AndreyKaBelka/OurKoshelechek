# Деплой и эксплуатация

Читать при изменениях в Docker, CI, миграциях, env-переменных, бэкапах.

## CI/CD (`.github/workflows/deploy.yml`)
- Триггер: **push в `master`** (или ручной `workflow_dispatch`). Отдельной ветки для
  разработки нет → любой пуш в `master` уходит в прод. Пушить только по просьбе владельца.
- `build`: собирает и пушит в GHCR три образа с тегами `<sha[:12]>` и `latest`:
  `ourkoshelechek-app` (`Dockerfile`), `ourkoshelechek-migrate` (`Dockerfile.migrate`,
  goose), `ourkoshelechek-frontend` (`frontend/Dockerfile`, `VITE_API_URL` из
  `vars.FRONTEND_API_URL`, по умолчанию `/query`).
- `deploy` (environment `production`): scp `docker-compose.prod.yml` на сервер →
  по SSH `docker compose pull` → `run --rm migrate` (**goose up на проде при каждом деплое**)
  → `up -d --remove-orphans` → `docker image prune -f`.
- Секреты: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_PORT`, `DEPLOY_PATH`,
  `GHCR_TOKEN`. Тестов/линта в CI сейчас нет — проверять локально до пуша.

## Сервисы (`docker-compose.yml` локально, `docker-compose.prod.yml` на сервере)
| Сервис | Что | Порт |
|---|---|---|
| `db` | postgres:16-alpine, volume `pgdata`, healthcheck `pg_isready` | — |
| `migrate` | goose `-dir /migrations up`, монтирует `./db/migrations` | — |
| `app` | Go-бэкенд, `JWT_SECRET` обязателен (`${JWT_SECRET:?err}`) | `PORT`, 8081 |
| `frontend` | nginx со сборкой Vite; `/query` проксируется на `app:8081` | `FRONTEND_PORT`, 3000 |
| `backup` | `prodrigestivill/postgres-backup-local`, дампы в `./backups` | — |

Локальный compose собирает образы из исходников (`build:`), прод — тянет готовые из GHCR.

## Переменные окружения (`.env.example`)
`POSTGRES_USER/PASSWORD/DB/PORT`, `PORT`, `JWT_SECRET`, `FRONTEND_PORT`,
`FRONTEND_API_URL`, `BACKUP_SCHEDULE` (`@daily`), `BACKUP_KEEP_DAYS/WEEKS/MONTHS`.
Для `make migrate-*` — `DB_DSN` (дефолт
`postgres://postgres:postgres@localhost:5432/ourkoshelechek?sslmode=disable`).

## Бэкапы
Ежедневные дампы в `./backups` на хосте (в `.gitignore`), ротация по дням/неделям/месяцам.
Перед рискованной миграцией на проде — убедиться, что свежий дамп есть.

## Особенности
- nginx резолвит `app` в момент запроса (`resolver 127.0.0.11` + переменная в
  `proxy_pass`) — фронт стартует и отдаёт статику, даже если бэкенд лежит.
- SPA-fallback `try_files $uri /index.html`; статика кэшируется 30 дней (`immutable`).
- `.dockerignore` исключает `*.md`, `docs/`, `frontend/`, `.claude/` из образа бэкенда —
  `context/*.md` в образ не попадает.
- Версии Go: `Dockerfile` — 1.26, `Dockerfile.migrate` — 1.25 (только для сборки goose).
- `make run-testserver` ссылается на `./cmd/testserver`, которого нет — цель мёртвая.
