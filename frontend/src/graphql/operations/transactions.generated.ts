// @ts-nocheck
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import * as Types from '../types';

import gql from 'graphql-tag';
import * as Urql from 'urql';
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type CreateTransactionInput = {
  amount: MoneyInput;
  categoryId: string;
  comment?: string | null | undefined;
  date: string;
  payer: PayerInput;
  type: TransactionType;
};

export type MoneyInput = {
  /** Сумма в минимальных единицах валюты (копейках). */
  amount: number;
};

export type PayerInput = {
  mode: PayerMode;
  /** Суммы участников, если mode = SPLIT; не обязателен — если не задан, сумма делится поровну между всеми участниками группы. Сумма amount по всем элементам должна быть равна Transaction.amount. */
  shares?: Array<PayerShareInput> | null | undefined;
  /** Обязателен, если mode = USER. */
  userId?: string | null | undefined;
};

export type PayerMode =
  /** Сумма делится между несколькими участниками группы; см. Payer.shares. */
  | 'SPLIT'
  | 'USER';

export type PayerShareInput = {
  amount: MoneyInput;
  userId: string;
};

export type TransactionFilter = {
  categoryId?: string | null | undefined;
  /** Нижняя граница по date, включительно. */
  dateFrom?: string | null | undefined;
  /** Верхняя граница по date, включительно. */
  dateTo?: string | null | undefined;
  payerUserId?: string | null | undefined;
  type?: TransactionType | null | undefined;
};

export type TransactionType =
  | 'EXPENSE'
  | 'INCOME';

export type TransactionsQueryVariables = Exact<{
  groupId: string;
  filter?: Types.TransactionFilter | null | undefined;
  first?: number | null | undefined;
}>;


export type TransactionsQuery = { transactions: { hasMore: boolean, total: number, items: Array<{ id: string, type: Types.TransactionType, date: string, comment: string | null, createdBy: string, createdAt: string, amount: { amount: number }, category: { id: string, name: string, icon: string }, payer: { mode: Types.PayerMode, userId: string | null, shares: Array<{ userId: string, amount: { amount: number } }> | null } }> } };

export type CreateTransactionMutationVariables = Exact<{
  groupId: string;
  input: Types.CreateTransactionInput;
}>;


export type CreateTransactionMutation = { createTransaction: { id: string, type: Types.TransactionType, date: string, comment: string | null, createdBy: string, createdAt: string, amount: { amount: number }, category: { id: string, name: string, icon: string }, payer: { mode: Types.PayerMode, userId: string | null, shares: Array<{ userId: string, amount: { amount: number } }> | null } } };


export const TransactionsDocument = gql`
    query Transactions($groupId: UUID!, $filter: TransactionFilter, $first: Int) {
  transactions(groupId: $groupId, filter: $filter, first: $first) {
    items {
      id
      type
      amount {
        amount
      }
      category {
        id
        name
        icon
      }
      payer {
        mode
        userId
        shares {
          userId
          amount {
            amount
          }
        }
      }
      date
      comment
      createdBy
      createdAt
    }
    hasMore
    total
  }
}
    `;

export function useTransactionsQuery(options: Omit<Urql.UseQueryArgs<TransactionsQueryVariables>, 'query'>) {
  return Urql.useQuery<TransactionsQuery, TransactionsQueryVariables>({ query: TransactionsDocument, ...options });
};
export const CreateTransactionDocument = gql`
    mutation CreateTransaction($groupId: UUID!, $input: CreateTransactionInput!) {
  createTransaction(groupId: $groupId, input: $input) {
    id
    type
    amount {
      amount
    }
    category {
      id
      name
      icon
    }
    payer {
      mode
      userId
      shares {
        userId
        amount {
          amount
        }
      }
    }
    date
    comment
    createdBy
    createdAt
  }
}
    `;

export function useCreateTransactionMutation() {
  return Urql.useMutation<CreateTransactionMutation, CreateTransactionMutationVariables>(CreateTransactionDocument);
};