# Code review — чистая архитектура (2026-09-21)

Результат `/code-review high` (мультиагентный, 6 finder-агентов) по всей текущей
кодовой базе. Список для последующей доработки, не чек-лист "сделано/не сделано".

## Критично — дыры в авторизации/консистентности

- [ ] **`internal/service/group.go:114`** — `RemoveMember` не проверяет права
  относительно цели действия: обычный `MEMBER` может удалить `OWNER` группы.
  `@requireGroupRole(min: MEMBER)` в схеме это пропускает, доп. проверки в сервисе нет.

- [ ] **`internal/service/transaction.go:154`** — `Update` пишет новый `category_id`
  внутри DB-транзакции раньше, чем проверяет, что категория принадлежит той же группе
  (проверка на строке ~173 идёт уже после commit). FK у `transactions.category_id`
  ссылается только на `categories(id)`, без учёта `group_id`.

- [ ] **`internal/service/budget.go:115`** — `UpdateSplit` принимает `userId` из
  инпута мутации без проверки членства в группе — можно назначить сплит дохода
  постороннему пользователю.

- [ ] **`internal/service/transaction.go:203`** — `resolveShares` не проверяет, что
  `userId` из явных `payer.shares` состоит в группе транзакции. FK на
  `transaction_payer_shares.user_id` ссылается только на `users(id)`, не на
  `group_members`.

- [ ] **`internal/service/goal.go:125`** — проверка существования категории
  «Накопления» выполняется до открытия DB-транзакции → гонка при параллельных
  `contributeToGoal` создаёт дубликаты категории (нет уникального индекса
  `(group_id, name)` в `categories`).

- [ ] **`internal/service/goal.go:52`** — `Create`/`Contribute` не проверяют, что
  `ownerUserId`/`userId` реально состоят в группе цели.

## Нарушения слоёв (чистая архитектура)

- [ ] **`internal/domain/user/repository.go:9`** (и аналогично во всех
  `internal/domain/*/repository.go`) — домен содержит pgx-реализацию репозитория с
  сырым SQL, что противоречит правилу CLAUDE.md "domain packages have no persistence
  knowledge". Нужно перепроверить на актуальном коде — после обновления CLAUDE.md
  появился `internal/repository.Repositories` и `platform.DBTX`, возможно часть
  разделения уже сделана иначе, чем на момент ревью.

- [ ] **`internal/service/budget.go:11`** (и весь `internal/service/*`) — сервисный
  слой импортирует `graph/model` и работает с GraphQL-типами напрямую вместо
  доменных. По CLAUDE.md конвертация model↔domain — обязанность
  mapper/резолверов, а не service.

- [ ] **`resolvers/directives.go:96`** — `domainRoleFromModel` дублирует
  `mapper.ToDomainGroupRole` (`internal/mapper/group.go:48`) — идентичная логика
  ролей поддерживается в двух местах, риск рассинхронизации при добавлении новой роли.

- [ ] **`internal/mapper/group.go:19`** — `ToDomainGroup` и аналогичные
  `ToDomain*`-функции строят доменные структуры литералом вместо `New<Entity>(...)`,
  минуя валидацию конструктора. Сейчас мёртвый код, но ловушка на будущее.

## Не в топ-10, но стоит знать

- N+1-запросы: `transaction.go` `List` (~274-286), `group.go` `loadGroupModel`
  (~154-161), `goal.go`/`group.go` списковые агрегации (~185-192, ~127-134).
- Непоследовательный перевод `ErrNotFound` в GraphQL-ошибку: `Get` делает
  `errors.Is`, `Update`/`Delete` — нет.
- Гонка в `user.go` `Register` при регистрации одинакового username — утечка сырой
  ошибки БД вместо понятного сентинела.
