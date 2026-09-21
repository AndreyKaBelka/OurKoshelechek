// @ts-nocheck
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import * as Types from '../types';

import gql from 'graphql-tag';
import * as Urql from 'urql';
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type HealthStatus =
  | 'DOWN'
  | 'OK';

export type HealthQueryVariables = Exact<{ [key: string]: never; }>;


export type HealthQuery = { health: Types.HealthStatus };


export const HealthDocument = gql`
    query Health {
  health
}
    `;

export function useHealthQuery(options?: Omit<Urql.UseQueryArgs<HealthQueryVariables>, 'query'>) {
  return Urql.useQuery<HealthQuery, HealthQueryVariables>({ query: HealthDocument, ...options });
};