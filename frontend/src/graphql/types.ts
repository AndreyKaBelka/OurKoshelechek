export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** Дата-время в формате RFC 3339 / ISO 8601, например 2026-09-20T12:00:00Z. */
  DateTime: { input: string; output: string; }
  /** UUID v4 в строковом представлении, например 123e4567-e89b-12d3-a456-426614174000. */
  UUID: { input: string; output: string; }
};

export type AuthPayload = {
  __typename?: 'AuthPayload';
  accessToken: Scalars['String']['output'];
  /** Срок жизни accessToken в секундах. */
  expiresIn: Scalars['Int']['output'];
  /** Срок жизни refreshToken в секундах. */
  refreshExpiresIn: Scalars['Int']['output'];
  /** Одноразовый долгоживущий токен для получения новой пары токенов через refreshToken. */
  refreshToken: Scalars['String']['output'];
  /** Тип токена для заголовка Authorization, всегда "Bearer". */
  tokenType: Scalars['String']['output'];
};

/**
 * Бюджет — это план расходов по категориям, а не процент от дохода: он не
 * требует и не зависит от указания планового дохода. income здесь — только
 * справочная величина, посчитанная из фактических INCOME-транзакций за
 * период; по факту дохода за период она равна summary.income.total.
 */
export type Budget = {
  __typename?: 'Budget';
  /** Разбивка расходов по категориям с лимитами. */
  categories: Array<BudgetCategory>;
  /** Доход за вычетом totalAllocated; может быть отрицательным. */
  free: Money;
  /** Суммарный фактический доход группы за период (справочно, не влияет на план расходов). */
  income: Money;
  /** Сумма, уже распределённая по категориям. */
  totalAllocated: Money;
};

export type BudgetCategory = {
  __typename?: 'BudgetCategory';
  /** Сумма, выделенная на категорию за период (равна её monthlyLimit). */
  amount: Money;
  categoryId: Scalars['UUID']['output'];
};

export type Category = {
  __typename?: 'Category';
  /** Иконка категории (эмодзи). */
  icon: Scalars['String']['output'];
  id: Scalars['UUID']['output'];
  /** Месячный лимит расходов по категории; null — лимит не задан. */
  monthlyLimit?: Maybe<Money>;
  name: Scalars['String']['output'];
};

export type CategoryAmount = {
  __typename?: 'CategoryAmount';
  amount: Money;
  /** Разбивка расхода категории по участникам (учитывает доли в разделённых операциях). */
  byMember: Array<MemberAmount>;
  categoryId: Scalars['UUID']['output'];
};

export type ContributeGoalInput = {
  amount: MoneyInput;
  date?: InputMaybe<Scalars['DateTime']['input']>;
};

export type CreateCategoryInput = {
  /** Иконка категории (эмодзи). */
  icon: Scalars['String']['input'];
  monthlyLimit?: InputMaybe<MoneyInput>;
  name: Scalars['String']['input'];
};

/** Для type = PERSONAL владельцем становится вызывающий пользователь. */
export type CreateGoalInput = {
  icon?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  targetAmount: MoneyInput;
  type: GoalType;
};

export type CreateGroupInput = {
  name: Scalars['String']['input'];
};

export type CreateTransactionInput = {
  amount: MoneyInput;
  /** Обязателен для type = EXPENSE; должен отсутствовать для type = INCOME и TRANSFER. */
  categoryId?: InputMaybe<Scalars['UUID']['input']>;
  comment?: InputMaybe<Scalars['String']['input']>;
  date: Scalars['DateTime']['input'];
  /** Для type = TRANSFER — отправитель, mode должен быть USER. */
  payer: PayerInput;
  /** Обязателен для type = TRANSFER (участник группы, отличный от отправителя); должен отсутствовать для остальных типов. */
  recipientUserId?: InputMaybe<Scalars['UUID']['input']>;
  type: TransactionType;
};

export type ExpenseSummary = {
  __typename?: 'ExpenseSummary';
  /** Разбивка расхода по категориям. */
  byCategory: Array<CategoryAmount>;
  /** Разбивка расхода по участникам (учитывает доли в разделённых операциях и отправленные переводы другим участникам). */
  byMember: Array<MemberAmount>;
  /** Суммарный расход группы за период (без переводов между участниками). */
  total: Money;
};

export type Goal = {
  __typename?: 'Goal';
  createdAt: Scalars['DateTime']['output'];
  currentAmount: Money;
  icon?: Maybe<Scalars['String']['output']>;
  id: Scalars['UUID']['output'];
  name: Scalars['String']['output'];
  ownerUserId?: Maybe<Scalars['UUID']['output']>;
  targetAmount: Money;
  type: GoalType;
};

/** Один взнос в цель накопления. */
export type GoalContribution = {
  __typename?: 'GoalContribution';
  amount: Money;
  date: Scalars['DateTime']['output'];
  goalId: Scalars['UUID']['output'];
  id: Scalars['UUID']['output'];
};

export type GoalType =
  /** Взносы только от одного участника (ownerUserId). */
  | 'PERSONAL'
  /** Взносы от нескольких участников группы, поровну. */
  | 'SHARED';

export type Group = {
  __typename?: 'Group';
  id: Scalars['UUID']['output'];
  /** Полный список участников группы. */
  members: Array<GroupMember>;
  name: Scalars['String']['output'];
};

export type GroupMember = {
  __typename?: 'GroupMember';
  /** ⚠️ зависит от решения о ролевой модели внутри группы. */
  role?: Maybe<GroupRole>;
  user: User;
};

export type GroupRole =
  | 'MEMBER'
  | 'OWNER';

export type GroupSummary = {
  __typename?: 'GroupSummary';
  /** Текущий баланс группы (доходы минус расходы) на момент запроса. */
  balance: Money;
  /** Изменение баланса за запрошенный период (period), может быть отрицательным. */
  balanceDeltaMonth: Money;
  expense: ExpenseSummary;
  income: IncomeSummary;
};

/** Элемент списка групп текущего пользователя (без полного списка участников). */
export type GroupSummaryItem = {
  __typename?: 'GroupSummaryItem';
  id: Scalars['UUID']['output'];
  membersCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
};

export type HealthStatus =
  | 'DOWN'
  | 'OK';

export type IncomeSummary = {
  __typename?: 'IncomeSummary';
  /** Разбивка дохода по участникам; включает полученные переводы от других участников. */
  byMember: Array<MemberAmount>;
  /** Суммарный доход группы за период (без переводов между участниками). */
  total: Money;
};

/** ⚠️ зависит от решения: добавление по username, либо по email с генерацией инвайт-кода. */
export type InviteMemberInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  username?: InputMaybe<Scalars['String']['input']>;
};

/** Заполняется одно из полей, в зависимости от способа приглашения (⚠️ см. InviteMemberInput). */
export type InviteResult = {
  __typename?: 'InviteResult';
  /** Идентификатор инвайта, если приглашение шло по email-коду. */
  inviteId?: Maybe<Scalars['UUID']['output']>;
  /** Идентификатор нового участника, если приглашение шло по username (добавление сразу). */
  memberId?: Maybe<Scalars['UUID']['output']>;
};

export type LoginInput = {
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};

export type MemberAmount = {
  __typename?: 'MemberAmount';
  amount: Money;
  userId: Scalars['UUID']['output'];
};

export type Money = {
  __typename?: 'Money';
  /** Сумма в минимальных единицах валюты (копейках). */
  amount: Scalars['Int']['output'];
};

export type MoneyInput = {
  /** Сумма в минимальных единицах валюты (копейках). */
  amount: Scalars['Int']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Пополнить цель; также создаёт операцию-расход категории «Накопления». */
  contributeToGoal: GoalContribution;
  /** Создать пользовательскую категорию группы. */
  createCategory: Category;
  /** Создать цель накопления группы. */
  createGoal: Goal;
  /** Создать группу; создатель становится первым участником. */
  createGroup: Group;
  /** Добавить операцию в группу. */
  createTransaction: Transaction;
  /** Удалить категорию группы. */
  deleteCategory: Scalars['Boolean']['output'];
  /** Удалить цель группы. */
  deleteGoal: Scalars['Boolean']['output'];
  /** Удалить операцию. */
  deleteTransaction: Scalars['Boolean']['output'];
  /** Пригласить/добавить участника в группу. */
  inviteMember: InviteResult;
  /** Войти по логину и паролю. */
  login: AuthPayload;
  /** Отозвать refresh-токен (выход из аккаунта на этом устройстве). Не требует access-токена. */
  logout: Scalars['Boolean']['output'];
  /** Обменять refresh-токен на новую пару токенов. Переданный refresh-токен становится недействительным. */
  refreshToken: AuthPayload;
  /** Зарегистрировать нового пользователя и сразу выдать токен. */
  register: AuthPayload;
  /** Удалить участника из группы. */
  removeMember: Scalars['Boolean']['output'];
  /** Изменить категорию, включая месячный лимит. */
  updateCategory: Category;
  /** Изменить параметры цели (тип и владельца изменить нельзя). */
  updateGoal: Goal;
  /** Переименовать группу. */
  updateGroup: Group;
  /** Отредактировать операцию (частичное обновление). */
  updateTransaction: Transaction;
  /** Снять деньги с цели (например, из подушки безопасности); нельзя снять больше текущей суммы. Также создаёт операцию-доход, возвращающую сумму в бюджет. */
  withdrawFromGoal: GoalContribution;
};


export type MutationContributeToGoalArgs = {
  goalId: Scalars['UUID']['input'];
  groupId: Scalars['UUID']['input'];
  input: ContributeGoalInput;
};


export type MutationCreateCategoryArgs = {
  groupId: Scalars['UUID']['input'];
  input: CreateCategoryInput;
};


export type MutationCreateGoalArgs = {
  groupId: Scalars['UUID']['input'];
  input: CreateGoalInput;
};


export type MutationCreateGroupArgs = {
  input: CreateGroupInput;
};


export type MutationCreateTransactionArgs = {
  groupId: Scalars['UUID']['input'];
  input: CreateTransactionInput;
};


export type MutationDeleteCategoryArgs = {
  categoryId: Scalars['UUID']['input'];
  groupId: Scalars['UUID']['input'];
};


export type MutationDeleteGoalArgs = {
  goalId: Scalars['UUID']['input'];
  groupId: Scalars['UUID']['input'];
};


export type MutationDeleteTransactionArgs = {
  groupId: Scalars['UUID']['input'];
  transactionId: Scalars['UUID']['input'];
};


export type MutationInviteMemberArgs = {
  groupId: Scalars['UUID']['input'];
  input: InviteMemberInput;
};


export type MutationLoginArgs = {
  input: LoginInput;
};


export type MutationLogoutArgs = {
  refreshToken: Scalars['String']['input'];
};


export type MutationRefreshTokenArgs = {
  refreshToken: Scalars['String']['input'];
};


export type MutationRegisterArgs = {
  input: RegisterInput;
};


export type MutationRemoveMemberArgs = {
  groupId: Scalars['UUID']['input'];
  userId: Scalars['UUID']['input'];
};


export type MutationUpdateCategoryArgs = {
  categoryId: Scalars['UUID']['input'];
  groupId: Scalars['UUID']['input'];
  input: UpdateCategoryInput;
};


export type MutationUpdateGoalArgs = {
  goalId: Scalars['UUID']['input'];
  groupId: Scalars['UUID']['input'];
  input: UpdateGoalInput;
};


export type MutationUpdateGroupArgs = {
  groupId: Scalars['UUID']['input'];
  input: UpdateGroupInput;
};


export type MutationUpdateTransactionArgs = {
  groupId: Scalars['UUID']['input'];
  input: UpdateTransactionInput;
  transactionId: Scalars['UUID']['input'];
};


export type MutationWithdrawFromGoalArgs = {
  goalId: Scalars['UUID']['input'];
  groupId: Scalars['UUID']['input'];
  input: WithdrawFromGoalInput;
};

export type Payer = {
  __typename?: 'Payer';
  mode: PayerMode;
  /** Явные суммы участников, если mode = SPLIT; null, если mode = USER. Сумма amount по всем элементам равна Transaction.amount. */
  shares?: Maybe<Array<PayerShare>>;
  /** Плательщик, если mode = USER; null, если mode = SPLIT. */
  userId?: Maybe<Scalars['UUID']['output']>;
};

export type PayerInput = {
  mode: PayerMode;
  /** Суммы участников, если mode = SPLIT; не обязателен — если не задан, сумма делится поровну между всеми участниками группы. Сумма amount по всем элементам должна быть равна Transaction.amount. */
  shares?: InputMaybe<Array<PayerShareInput>>;
  /** Обязателен, если mode = USER. */
  userId?: InputMaybe<Scalars['UUID']['input']>;
};

export type PayerMode =
  /** Сумма делится между несколькими участниками группы; см. Payer.shares. */
  | 'SPLIT'
  | 'USER';

/** Доля одного участника при payer.mode = SPLIT. */
export type PayerShare = {
  __typename?: 'PayerShare';
  amount: Money;
  userId: Scalars['UUID']['output'];
};

export type PayerShareInput = {
  amount: MoneyInput;
  userId: Scalars['UUID']['input'];
};

export type PeriodSummary = {
  __typename?: 'PeriodSummary';
  expense: ExpenseSummary;
  income: IncomeSummary;
};

export type Query = {
  __typename?: 'Query';
  /** Текущий план бюджета за период: лимиты по категориям и справочный доход. period в формате YYYY-MM. */
  budget: Budget;
  /** Список категорий группы (дефолтные + пользовательские). */
  categories: Array<Category>;
  /** История взносов в цель (для прогноза срока достижения). */
  goalContributions: Array<GoalContribution>;
  /** Список целей накоплений группы. */
  goals: Array<Goal>;
  /** Детали группы и список участников. */
  group?: Maybe<Group>;
  /** Список групп текущего пользователя. */
  groups: Array<GroupSummaryItem>;
  /** Healthcheck для БД/деплоя. */
  health: HealthStatus;
  /** Текущий авторизованный пользователь (требует Authorization: Bearer <token>). */
  me: User;
  /** Доходы и расходы группы за произвольный период. dateFrom и dateTo в формате YYYY-MM-DD, обе границы включительно. */
  periodSummary: PeriodSummary;
  /** Агрегированная сводка группы за период (обзорная страница). period в формате YYYY-MM. */
  summary: GroupSummary;
  /** Получить одну операцию по id; null, если не найдена или не принадлежит группе. */
  transaction?: Maybe<Transaction>;
  /** История операций группы с фильтром и курсорной пагинацией. */
  transactions: TransactionList;
};


export type QueryBudgetArgs = {
  groupId: Scalars['UUID']['input'];
  period: Scalars['String']['input'];
};


export type QueryCategoriesArgs = {
  groupId: Scalars['UUID']['input'];
};


export type QueryGoalContributionsArgs = {
  goalId: Scalars['UUID']['input'];
  groupId: Scalars['UUID']['input'];
};


export type QueryGoalsArgs = {
  groupId: Scalars['UUID']['input'];
};


export type QueryGroupArgs = {
  groupId: Scalars['UUID']['input'];
};


export type QueryPeriodSummaryArgs = {
  dateFrom: Scalars['String']['input'];
  dateTo: Scalars['String']['input'];
  groupId: Scalars['UUID']['input'];
};


export type QuerySummaryArgs = {
  groupId: Scalars['UUID']['input'];
  period: Scalars['String']['input'];
};


export type QueryTransactionArgs = {
  groupId: Scalars['UUID']['input'];
  transactionId: Scalars['UUID']['input'];
};


export type QueryTransactionsArgs = {
  after?: InputMaybe<Scalars['UUID']['input']>;
  filter?: InputMaybe<TransactionFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  groupId: Scalars['UUID']['input'];
};

export type RegisterInput = {
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};

export type Transaction = {
  __typename?: 'Transaction';
  amount: Money;
  /** Категория расхода; null для type = INCOME и TRANSFER. */
  category?: Maybe<Category>;
  comment?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  /** Пользователь, создавший операцию (может отличаться от payer). */
  createdBy: Scalars['UUID']['output'];
  date: Scalars['DateTime']['output'];
  id: Scalars['UUID']['output'];
  /** Для type = TRANSFER — отправитель перевода (всегда mode = USER). */
  payer: Payer;
  /** Получатель перевода; задан только для type = TRANSFER. */
  recipientUserId?: Maybe<Scalars['UUID']['output']>;
  type: TransactionType;
};

export type TransactionFilter = {
  categoryId?: InputMaybe<Scalars['UUID']['input']>;
  /** Нижняя граница по date, включительно. */
  dateFrom?: InputMaybe<Scalars['DateTime']['input']>;
  /** Верхняя граница по date, включительно. */
  dateTo?: InputMaybe<Scalars['DateTime']['input']>;
  payerUserId?: InputMaybe<Scalars['UUID']['input']>;
  recipientUserId?: InputMaybe<Scalars['UUID']['input']>;
  type?: InputMaybe<TransactionType>;
};

export type TransactionList = {
  __typename?: 'TransactionList';
  /** true, если есть ещё операции после текущей страницы. */
  hasMore: Scalars['Boolean']['output'];
  items: Array<Transaction>;
  /** Курсор для запроса следующей страницы через аргумент after; null, если дальше ничего нет. */
  nextCursor?: Maybe<Scalars['UUID']['output']>;
  /** Общее число операций, подходящих под filter, вне зависимости от размера текущей страницы. */
  total: Scalars['Int']['output'];
};

export type TransactionType =
  | 'EXPENSE'
  | 'INCOME'
  /** Перевод от одного участника группы другому: для отправителя (payer.userId) это расход, для получателя (recipientUserId) — доход. Не влияет на общий баланс и итоги группы. */
  | 'TRANSFER';

export type UpdateCategoryInput = {
  icon?: InputMaybe<Scalars['String']['input']>;
  monthlyLimit?: InputMaybe<MoneyInput>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateGoalInput = {
  icon?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  targetAmount?: InputMaybe<MoneyInput>;
};

export type UpdateGroupInput = {
  name: Scalars['String']['input'];
};

export type UpdateTransactionInput = {
  amount?: InputMaybe<MoneyInput>;
  categoryId?: InputMaybe<Scalars['UUID']['input']>;
  comment?: InputMaybe<Scalars['String']['input']>;
  date?: InputMaybe<Scalars['DateTime']['input']>;
  payer?: InputMaybe<PayerInput>;
  /** Получатель перевода; при смене типа на не-TRANSFER сбрасывается автоматически. */
  recipientUserId?: InputMaybe<Scalars['UUID']['input']>;
  type?: InputMaybe<TransactionType>;
};

export type User = {
  __typename?: 'User';
  id: Scalars['UUID']['output'];
  username: Scalars['String']['output'];
};

export type WithdrawFromGoalInput = {
  amount: MoneyInput;
  date?: InputMaybe<Scalars['DateTime']['input']>;
};
