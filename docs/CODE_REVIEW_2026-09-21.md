# Code review — чистая архитектура (2026-09-21)

Результат `/code-review high` (мультиагентный, 6 finder-агентов) по всей текущей
кодовой базе. Список для последующей доработки, не чек-лист "сделано/не сделано".

## Критично — дыры в авторизации/консистентности

- [x] **`internal/service/group.go:114`** — `RemoveMember` не проверяет права
  относительно цели действия: обычный `MEMBER` может удалить `OWNER` группы.
  `@requireGroupRole(min: MEMBER)` в схеме это пропускает, доп. проверки в сервисе нет.
  **Исправлено 2026-09-22**: `RemoveMember` теперь берёт роль вызывающего и цели
  через `GroupMember.Get` и требует `actor.Role.AtLeast(target.Role)`, кроме
  случая, когда участник удаляет сам себя (выход из группы).

- [x] **`internal/service/transaction.go:154`** — `Update` пишет новый `category_id`
  внутри DB-транзакции раньше, чем проверяет, что категория принадлежит той же группе
  (проверка на строке ~173 идёт уже после commit). FK у `transactions.category_id`
  ссылается только на `categories(id)`, без учёта `group_id`.
  **Исправлено 2026-09-22**: проверка `Category.GetByID(ctx, groupID, newCategoryID)`
  перенесена перед `RunInTx`, как в `Create`.

- [x] **`internal/service/budget.go:115`** — `UpdateSplit` принимает `userId` из
  инпута мутации без проверки членства в группе — можно назначить сплит дохода
  постороннему пользователю.
  **Исправлено 2026-09-22**: добавлен общий хелпер `requireGroupMember`
  (`internal/service/membership.go`), `UpdateSplit` вызывает его для каждого `userId`.

- [x] **`internal/service/transaction.go:203`** — `resolveShares` не проверяет, что
  `userId` из явных `payer.shares` состоит в группе транзакции. FK на
  `transaction_payer_shares.user_id` ссылается только на `users(id)`, не на
  `group_members`.
  **Исправлено 2026-09-22**: `resolveShares` вызывает `requireGroupMember` для
  каждого явного `payer.shares[i].userId`.

- [x] **`internal/service/goal.go:125`** — проверка существования категории
  «Накопления» выполняется до открытия DB-транзакции → гонка при параллельных
  `contributeToGoal` создаёт дубликаты категории (нет уникального индекса
  `(group_id, name)` в `categories`).
  **Исправлено 2026-09-22**: добавлен `idx_categories_group_id_name` (уникальный,
  в миграции `20260921162835_init_db.sql`, ещё не выпущенной) и
  `category.Repository.GetOrCreate` (`INSERT ... ON CONFLICT DO NOTHING` +
  `SELECT`), `Contribute` больше не делает check-then-create.

- [x] **`internal/service/goal.go:52`** — `Create`/`Contribute` не проверяют, что
  `ownerUserId`/`userId` реально состоят в группе цели.
  **Исправлено 2026-09-22**: оба места вызывают `requireGroupMember`.

## Нарушения слоёв (чистая архитектура)

- [x] **`internal/domain/user/repository.go:9`** (и аналогично во всех
  `internal/domain/*/repository.go`) — домен содержит pgx-реализацию репозитория с
  сырым SQL, что противоречит правилу CLAUDE.md "domain packages have no persistence
  knowledge". ~~Нужно перепроверить на актуальном коде~~ — **перепроверено 2026-09-22**:
  текущий CLAUDE.md прямо описывает это как целевую архитектуру ("Repositories are
  pgx-based (no ORM)... in `internal/domain/<name>/`"), так что это не нарушение, а
  устаревший пункт ревью относительно более старой версии CLAUDE.md. Изменений не
  требуется.

- [ ] **`internal/service/budget.go:11`** (и весь `internal/service/*`) — сервисный
  слой импортирует `graph/model` и работает с GraphQL-типами напрямую вместо
  доменных. По CLAUDE.md конвертация model↔domain — обязанность
  mapper/резолверов, а не service.
  **Не исправлено намеренно**: затрагивает сигнатуры почти всех методов во всех 7
  файлах `internal/service/*` (~1150 строк) и всех вызывающих резолверов, плюс
  потребует новых domain↔model мапперов для input/output типов каждого метода.
  Слишком большой и рискованный рефакторинг, чтобы делать его вслепую в рамках
  этого прохода — стоит планировать отдельно, по одному сервису за раз, с ревью.

- [x] **`resolvers/directives.go:96`** — `domainRoleFromModel` дублирует
  `mapper.ToDomainGroupRole` (`internal/mapper/group.go:48`) — идентичная логика
  ролей поддерживается в двух местах, риск рассинхронизации при добавлении новой роли.
  **Исправлено 2026-09-22**: `domainRoleFromModel` удалена, `requireGroupRole`
  использует `mapper.ToDomainGroupRole`.

- [x] **`internal/mapper/group.go:19`** — `ToDomainGroup` и аналогичные
  `ToDomain*`-функции строят доменные структуры литералом вместо `New<Entity>(...)`,
  минуя валидацию конструктора. Сейчас мёртвый код, но ловушка на будущее.
  **Исправлено 2026-09-22**: `ToDomainGroup` и `ToDomainGroupMember` были
  неиспользуемым мёртвым кодом (проверено — нет вызывающих) и удалены целиком,
  а не переписаны через конструктор.

## Не в топ-10, но стоит знать

- [ ] N+1-запросы: `transaction.go` `List` (~274-286), `group.go` `loadGroupModel`
  (~154-161), `goal.go`/`group.go` списковые агрегации (~185-192, ~127-134).
  Не исправлено — производительность, не корректность; вне рамок этого прохода.
- [ ] Непоследовательный перевод `ErrNotFound` в GraphQL-ошибку: `Get` делает
  `errors.Is`, `Update`/`Delete` — нет. Не исправлено.
- [x] Гонка в `user.go` `Register` при регистрации одинакового username — утечка сырой
  ошибки БД вместо понятного сентинела.
  **Исправлено 2026-09-22**: `user.Repository.Create` транслирует unique violation
  (Postgres code `23505`) в `user.ErrUsernameTaken`, `UserService.Register`
  перехватывает её и возвращает свой `ErrUsernameTaken` — на случай гонки между
  предварительной проверкой `GetByUsername` и `Create`.
