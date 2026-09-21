// @ts-nocheck
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import * as Types from '../types';

import gql from 'graphql-tag';
import * as Urql from 'urql';
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
/** Сумма shareAmount по всем участникам должна быть равна доходу. */
export type BudgetSplitInput = {
  shareAmount: MoneyInput;
  userId: string;
};

export type MoneyInput = {
  /** Сумма в минимальных единицах валюты (копейках). */
  amount: number;
};

export type BudgetQueryVariables = Exact<{
  groupId: string;
  period: string;
}>;


export type BudgetQuery = { budget: { income: { amount: number }, split: Array<{ userId: string, shareAmount: { amount: number } }>, totalAllocated: { amount: number }, free: { amount: number } } };

export type UpdateBudgetSplitMutationVariables = Exact<{
  groupId: string;
  split: Array<Types.BudgetSplitInput> | Types.BudgetSplitInput;
}>;


export type UpdateBudgetSplitMutation = { updateBudgetSplit: Array<{ userId: string, shareAmount: { amount: number } }> };


export const BudgetDocument = gql`
    query Budget($groupId: UUID!, $period: String!) {
  budget(groupId: $groupId, period: $period) {
    income {
      amount
    }
    split {
      userId
      shareAmount {
        amount
      }
    }
    totalAllocated {
      amount
    }
    free {
      amount
    }
  }
}
    `;

export function useBudgetQuery(options: Omit<Urql.UseQueryArgs<BudgetQueryVariables>, 'query'>) {
  return Urql.useQuery<BudgetQuery, BudgetQueryVariables>({ query: BudgetDocument, ...options });
};
export const UpdateBudgetSplitDocument = gql`
    mutation UpdateBudgetSplit($groupId: UUID!, $split: [BudgetSplitInput!]!) {
  updateBudgetSplit(groupId: $groupId, split: $split) {
    userId
    shareAmount {
      amount
    }
  }
}
    `;

export function useUpdateBudgetSplitMutation() {
  return Urql.useMutation<UpdateBudgetSplitMutation, UpdateBudgetSplitMutationVariables>(UpdateBudgetSplitDocument);
};