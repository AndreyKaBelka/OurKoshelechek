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


export type SummaryQuery = { summary: { balance: { amount: number }, balanceDeltaMonth: { amount: number }, income: { total: { amount: number }, byMember: Array<{ userId: string, amount: { amount: number } }> }, expense: { total: { amount: number }, byCategory: Array<{ categoryId: string, amount: { amount: number } }>, byMember: Array<{ userId: string, amount: { amount: number } }> } } };

export type PeriodSummaryQueryVariables = Exact<{
  groupId: string;
  dateFrom: string;
  dateTo: string;
}>;


export type PeriodSummaryQuery = { periodSummary: { income: { total: { amount: number }, byMember: Array<{ userId: string, amount: { amount: number } }> }, expense: { total: { amount: number }, byCategory: Array<{ categoryId: string, amount: { amount: number }, byMember: Array<{ userId: string, amount: { amount: number } }> }>, byMember: Array<{ userId: string, amount: { amount: number } }> } } };


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
      byMember {
        userId
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
export const PeriodSummaryDocument = gql`
    query PeriodSummary($groupId: UUID!, $dateFrom: String!, $dateTo: String!) {
  periodSummary(groupId: $groupId, dateFrom: $dateFrom, dateTo: $dateTo) {
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
        byMember {
          userId
          amount {
            amount
          }
        }
      }
      byMember {
        userId
        amount {
          amount
        }
      }
    }
  }
}
    `;

export function usePeriodSummaryQuery(options: Omit<Urql.UseQueryArgs<PeriodSummaryQueryVariables>, 'query'>) {
  return Urql.useQuery<PeriodSummaryQuery, PeriodSummaryQueryVariables>({ query: PeriodSummaryDocument, ...options });
};