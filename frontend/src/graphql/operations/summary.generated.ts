// @ts-nocheck
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import * as Types from '../types';

import gql from 'graphql-tag';
import * as Urql from 'urql';
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type SummaryQueryVariables = Exact<{
  groupId: string;
  period: string;
}>;


export type SummaryQuery = { summary: { balance: { amount: number }, balanceDeltaMonth: { amount: number }, income: { total: { amount: number }, byMember: Array<{ userId: string, amount: { amount: number } }> }, expense: { total: { amount: number }, byCategory: Array<{ categoryId: string, amount: { amount: number } }> } } };


export const SummaryDocument = gql`
    query Summary($groupId: UUID!, $period: String!) {
  summary(groupId: $groupId, period: $period) {
    balance {
      amount
    }
    balanceDeltaMonth {
      amount
    }
    income {
      total {
        amount
      }
      byMember {
        userId
        amount {
          amount
        }
      }
    }
    expense {
      total {
        amount
      }
      byCategory {
        categoryId
        amount {
          amount
        }
      }
    }
  }
}
    `;

export function useSummaryQuery(options: Omit<Urql.UseQueryArgs<SummaryQueryVariables>, 'query'>) {
  return Urql.useQuery<SummaryQuery, SummaryQueryVariables>({ query: SummaryDocument, ...options });
};