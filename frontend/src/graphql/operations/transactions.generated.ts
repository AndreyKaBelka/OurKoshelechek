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
  /** Обязателен для type = EXPENSE; должен отсутствовать для type = INCOME и TRANSFER. */
  categoryId?: string | null | undefined;
  comment?: string | null | undefined;
  date: string;
  /** Для type = TRANSFER — отправитель, mode должен быть USER. */
  payer: PayerInput;
  /** Обязателен для type = TRANSFER (участник группы, отличный от отправителя); должен отсутствовать для остальных типов. */
  recipientUserId?: string | null | undefined;
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
  recipientUserId?: string | null | undefined;
  type?: TransactionType | null | undefined;
};

export type TransactionType =
  | 'EXPENSE'
  | 'INCOME'
  /** Перевод от одного участника группы другому: для отправителя (payer.userId) это расход, для получателя (recipientUserId) — доход. Не влияет на общий баланс и итоги группы. */
  | 'TRANSFER';

export type UpdateTransactionInput = {
  amount?: MoneyInput | null | undefined;
  categoryId?: string | null | undefined;
  comment?: string | null | undefined;
  date?: string | null | undefined;
  payer?: PayerInput | null | undefined;
  /** Получатель перевода; при смене типа на не-TRANSFER сбрасывается автоматически. */
  recipientUserId?: string | null | undefined;
  type?: TransactionType | null | undefined;
};

export type TransactionsQueryVariables = Exact<{
  groupId: string;
  filter?: Types.TransactionFilter | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type TransactionsQuery = { transactions: { nextCursor: string | null, hasMore: boolean, total: number, items: Array<{ id: string, type: Types.TransactionType, recipientUserId: string | null, date: string, comment: string | null, createdBy: string, createdAt: string, amount: { amount: number }, category: { id: string, name: string, icon: string } | null, payer: { mode: Types.PayerMode, userId: string | null, shares: Array<{ userId: string, amount: { amount: number } }> | null } }> } };

export type CreateTransactionMutationVariables = Exact<{
  groupId: string;
  input: Types.CreateTransactionInput;
}>;


export type CreateTransactionMutation = { createTransaction: { id: string, type: Types.TransactionType, recipientUserId: string | null, date: string, comment: string | null, createdBy: string, createdAt: string, amount: { amount: number }, category: { id: string, name: string, icon: string } | null, payer: { mode: Types.PayerMode, userId: string | null, shares: Array<{ userId: string, amount: { amount: number } }> | null } } };

export type UpdateTransactionMutationVariables = Exact<{
  groupId: string;
  transactionId: string;
  input: Types.UpdateTransactionInput;
}>;


export type UpdateTransactionMutation = { updateTransaction: { id: string, type: Types.TransactionType, recipientUserId: string | null, date: string, comment: string | null, createdBy: string, createdAt: string, amount: { amount: number }, category: { id: string, name: string, icon: string } | null, payer: { mode: Types.PayerMode, userId: string | null, shares: Array<{ userId: string, amount: { amount: number } }> | null } } };

export type DeleteTransactionMutationVariables = Exact<{
  groupId: string;
  transactionId: string;
}>;


export type DeleteTransactionMutation = { deleteTransaction: boolean };


export const TransactionsDocument = gql`
    query Transactions($groupId: UUID!, $filter: TransactionFilter, $first: Int, $after: UUID) {
  transactions(groupId: $groupId, filter: $filter, first: $first, after: $after) {
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
      recipientUserId
      date
      comment
      createdBy
      createdAt
    }
    nextCursor
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
    recipientUserId
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
export const UpdateTransactionDocument = gql`
    mutation UpdateTransaction($groupId: UUID!, $transactionId: UUID!, $input: UpdateTransactionInput!) {
  updateTransaction(
    groupId: $groupId
    transactionId: $transactionId
    input: $input
  ) {
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
    recipientUserId
    date
    comment
    createdBy
    createdAt
  }
}
    `;

export function useUpdateTransactionMutation() {
  return Urql.useMutation<UpdateTransactionMutation, UpdateTransactionMutationVariables>(UpdateTransactionDocument);
};
export const DeleteTransactionDocument = gql`
    mutation DeleteTransaction($groupId: UUID!, $transactionId: UUID!) {
  deleteTransaction(groupId: $groupId, transactionId: $transactionId)
}
    `;

export function useDeleteTransactionMutation() {
  return Urql.useMutation<DeleteTransactionMutation, DeleteTransactionMutationVariables>(DeleteTransactionDocument);
};