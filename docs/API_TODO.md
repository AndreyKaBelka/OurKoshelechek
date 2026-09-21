# Ручки, которые нужно реализовать

> Дополнение к `docs/BUSINESS_OVERVIEW.md`. Ниже — предлагаемый состав REST API под функции
> из макетов (`design/*.html`), которых сейчас нет в коде. Пути, поля и коды ответов —
> черновой вариант для обсуждения, не финальный контракт. Часть решений зависит от открытых
> вопросов из §6 `BUSINESS_OVERVIEW.md` (роли в группе, инвайты и т.д.) — где это влияет на
> дизайн ручки, отмечено пометкой «⚠️ зависит от решения».
>
> Существующие ручки (`/register`, `/login`, `/me`) не дублируются здесь — см.
> `BUSINESS_OVERVIEW.md` §4.
>
> Все ручки ниже, кроме `/register` и `/login`, требуют `Authorization: Bearer <token>`.

## 1. Группы

Группа — общий бюджет на N участников (см. `BUSINESS_OVERVIEW.md` §2).

| Метод | Путь | Назначение | Тело запроса / параметры | Ответ |
|---|---|---|---|---|
| POST | `/groups` | Создать группу, создатель становится первым участником | `{name}` | `{id, name, members: [...]}` |
| GET | `/groups` | Список групп текущего пользователя | — | `[{id, name, membersCount}]` |
| GET | `/groups/{groupId}` | Детали группы и список участников | — | `{id, name, members: [{userId, username, role?}]}` |
| POST | `/groups/{groupId}/invite` | Пригласить/добавить участника | ⚠️ зависит от решения: `{username}` (прямое добавление) либо `{email}` + генерация инвайт-кода | `{inviteId или memberId}` |
| DELETE | `/groups/{groupId}/members/{userId}` | Удалить участника из группы | — | `204` |
| PATCH | `/groups/{groupId}` | Переименовать группу | `{name}` | `{id, name}` |

## 2. Категории бюджета

Справочник категорий на группу (дефолтные + пользовательские), используется и в операциях,
и в бюджете (`design/Transaction.html` — выпадающий список, `design/Budget.html` — лимиты).

| Метод | Путь | Назначение | Тело запроса / параметры | Ответ |
|---|---|---|---|---|
| GET | `/groups/{groupId}/categories` | Список категорий группы | — | `[{id, name, icon, monthlyLimit}]` |
| POST | `/groups/{groupId}/categories` | Создать категорию | `{name, icon?, monthlyLimit?}` | `{id, name, icon, monthlyLimit}` |
| PATCH | `/groups/{groupId}/categories/{categoryId}` | Изменить категорию (в т.ч. лимит — см. `design/Budget.html`, поле "amt...") | `{name?, icon?, monthlyLimit?}` | `{id, name, icon, monthlyLimit}` |
| DELETE | `/groups/{groupId}/categories/{categoryId}` | Удалить категорию | — | `204` |

## 3. Операции (транзакции)

Соответствует `design/Transaction.html` (форма добавления + история с фильтром).

| Метод | Путь | Назначение | Тело запроса / параметры | Ответ |
|---|---|---|---|---|
| POST | `/groups/{groupId}/transactions` | Добавить операцию | `{type: "income"\|"expense", amount, categoryId, payer: {mode: "user"\|"split", userId?}, date, comment?}` | `{id, ...}` |
| GET | `/groups/{groupId}/transactions` | История операций с фильтром | query: `type`, `categoryId`, `payerUserId`, `dateFrom`, `dateTo`, `first`, `after` (курсор) | `{items: [...], nextCursor, hasMore, total}` |
| GET | `/groups/{groupId}/transactions/{txId}` | Получить одну операцию | — | `{id, type, amount, categoryId, payer, date, comment, createdBy, createdAt}` |
| PATCH | `/groups/{groupId}/transactions/{txId}` | Отредактировать операцию | те же поля, что при создании (частично) | `{id, ...}` |
| DELETE | `/groups/{groupId}/transactions/{txId}` | Удалить операцию | — | `204` |

Примечание: `payer.mode: "split"` реализует значение «Поровну» из формы — сумма делится
между участниками группы поровну (при N участниках — не только 50/50, как в макете на 2
человек).

## 4. Обзор / сводка

Соответствует `design/Main.html` (карточки баланса, доходов, расходов по категориям).

| Метод | Путь | Назначение | Тело запроса / параметры | Ответ |
|---|---|---|---|---|
| GET | `/groups/{groupId}/summary` | Агрегированная сводка за период | query: `period` (`YYYY-MM`) | `{balance, balanceDeltaMonth, income: {total, byMember: [{userId, amount}]}, expense: {total, byCategory: [{categoryId, amount}]}}` |

Список «последних операций» на обзорной странице переиспользует
`GET /groups/{groupId}/transactions?first=6` — отдельная ручка не нужна.

## 5. Бюджет

Соответствует `design/Budget.html`: доля распределения расходов между участниками + лимиты
по категориям (лимиты уже покрыты п.2 «Категории»).

| Метод | Путь | Назначение | Тело запроса / параметры | Ответ |
|---|---|---|---|---|
| GET | `/groups/{groupId}/budget?period=YYYY-MM` | Текущее распределение бюджета за период: доля участников, итог по категориям, доход, распределено, свободно | — | `{income, split: [{userId, shareAmount}], categories: [{categoryId, amount, pctOfIncome}], totalAllocated, free}` |
| PUT | `/groups/{groupId}/budget/split` | Обновить доли распределения расходов между участниками | `{split: [{userId, shareAmount}]}` (сумма = доход) | `{split: [...]}` |

Лимиты по категориям изменяются через `PATCH /groups/{groupId}/categories/{categoryId}`
(поле `monthlyLimit`), отдельная ручка не нужна.

## 6. Цели накоплений

Соответствует `design/Goals.html`.

| Метод | Путь | Назначение | Тело запроса / параметры | Ответ |
|---|---|---|---|---|
| GET | `/groups/{groupId}/goals` | Список целей + сводка (всего отложено, активных целей, отложено за месяц считается на фронте суммированием) | — | `[{id, name, icon, targetAmount, currentAmount, type: "shared"\|"personal", ownerUserId?, createdAt}]` |
| POST | `/groups/{groupId}/goals` | Создать цель | `{name, icon?, targetAmount, type: "shared"\|"personal", ownerUserId?}` (`ownerUserId` обязателен для `personal`) | `{id, ...}` |
| PATCH | `/groups/{groupId}/goals/{goalId}` | Отредактировать цель | `{name?, targetAmount?, icon?}` | `{id, ...}` |
| DELETE | `/groups/{groupId}/goals/{goalId}` | Удалить цель | — | `204` |
| POST | `/groups/{groupId}/goals/{goalId}/contributions` | Пополнить цель (кнопка «Пополнить») | `{amount, userId, date?}` | `{id, goalId, amount, userId, date}` — создаёт также операцию-расход категории «Накопления», см. `BUSINESS_OVERVIEW.md` §5 |
| GET | `/groups/{groupId}/goals/{goalId}/contributions` | История взносов в цель (для прогноза срока — «ещё ≈ N месяцев») | — | `[{id, amount, userId, date}]` |

## 7. Не покрыто макетами, но потребуется технически

- `GET /health` — healthcheck для БД/деплоя (сейчас отсутствует даже у тестового сервера).
- Ручки раздела «Настройки» — макета нет, содержимое не определено (см.
  `BUSINESS_OVERVIEW.md` §3.5).

## 8. Открытые вопросы, влияющие на контракт ручек

Дублирую из `BUSINESS_OVERVIEW.md` §6 то, что напрямую меняет форму запросов/ответов выше:

- Формат инвайта в группу (`POST /groups/{groupId}/invite`) — по логину или по email/коду.
- Наличие ролей внутри группы — повлияет на права вызова `DELETE /members`, `PATCH /groups`.
- Мультивалютность — если да, во все денежные поля (`amount`, `targetAmount`,
  `monthlyLimit`, `shareAmount`) добавляется `currency`.
