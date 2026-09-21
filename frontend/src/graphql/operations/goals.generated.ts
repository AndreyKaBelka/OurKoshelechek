// @ts-nocheck
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import * as Types from '../types';

import gql from 'graphql-tag';
import * as Urql from 'urql';
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type ContributeGoalInput = {
  amount: MoneyInput;
  date?: string | null | undefined;
};

/** Для type = PERSONAL владельцем становится вызывающий пользователь. */
export type CreateGoalInput = {
  icon?: string | null | undefined;
  name: string;
  targetAmount: MoneyInput;
  type: GoalType;
};

export type GoalType =
  /** Взносы только от одного участника (ownerUserId). */
  | 'PERSONAL'
  /** Взносы от нескольких участников группы, поровну. */
  | 'SHARED';

export type MoneyInput = {
  /** Сумма в минимальных единицах валюты (копейках). */
  amount: number;
};

export type GoalsQueryVariables = Exact<{
  groupId: string;
}>;


export type GoalsQuery = { goals: Array<{ id: string, name: string, icon: string | null, type: Types.GoalType, ownerUserId: string | null, createdAt: string, targetAmount: { amount: number }, currentAmount: { amount: number } }> };

export type CreateGoalMutationVariables = Exact<{
  groupId: string;
  input: Types.CreateGoalInput;
}>;


export type CreateGoalMutation = { createGoal: { id: string, name: string, icon: string | null, type: Types.GoalType, ownerUserId: string | null, createdAt: string, targetAmount: { amount: number }, currentAmount: { amount: number } } };

export type ContributeToGoalMutationVariables = Exact<{
  groupId: string;
  goalId: string;
  input: Types.ContributeGoalInput;
}>;


export type ContributeToGoalMutation = { contributeToGoal: { id: string, goalId: string, date: string, amount: { amount: number } } };


export const GoalsDocument = gql`
    query Goals($groupId: UUID!) {
  goals(groupId: $groupId) {
    id
    name
    icon
    targetAmount {
      amount
    }
    currentAmount {
      amount
    }
    type
    ownerUserId
    createdAt
  }
}
    `;

export function useGoalsQuery(options: Omit<Urql.UseQueryArgs<GoalsQueryVariables>, 'query'>) {
  return Urql.useQuery<GoalsQuery, GoalsQueryVariables>({ query: GoalsDocument, ...options });
};
export const CreateGoalDocument = gql`
    mutation CreateGoal($groupId: UUID!, $input: CreateGoalInput!) {
  createGoal(groupId: $groupId, input: $input) {
    id
    name
    icon
    targetAmount {
      amount
    }
    currentAmount {
      amount
    }
    type
    ownerUserId
    createdAt
  }
}
    `;

export function useCreateGoalMutation() {
  return Urql.useMutation<CreateGoalMutation, CreateGoalMutationVariables>(CreateGoalDocument);
};
export const ContributeToGoalDocument = gql`
    mutation ContributeToGoal($groupId: UUID!, $goalId: UUID!, $input: ContributeGoalInput!) {
  contributeToGoal(groupId: $groupId, goalId: $goalId, input: $input) {
    id
    goalId
    amount {
      amount
    }
    date
  }
}
    `;

export function useContributeToGoalMutation() {
  return Urql.useMutation<ContributeToGoalMutation, ContributeToGoalMutationVariables>(ContributeToGoalDocument);
};