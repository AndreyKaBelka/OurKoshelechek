// @ts-nocheck
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import * as Types from '../types';

import gql from 'graphql-tag';
import * as Urql from 'urql';
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type LoginInput = {
  password: string;
  username: string;
};

export type RegisterInput = {
  password: string;
  username: string;
};

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { me: { id: string, username: string } };

export type AuthTokensFragment = { accessToken: string, tokenType: string, expiresIn: number, refreshToken: string, refreshExpiresIn: number };

export type RegisterMutationVariables = Exact<{
  input: Types.RegisterInput;
}>;


export type RegisterMutation = { register: { accessToken: string, tokenType: string, expiresIn: number, refreshToken: string, refreshExpiresIn: number } };

export type LoginMutationVariables = Exact<{
  input: Types.LoginInput;
}>;


export type LoginMutation = { login: { accessToken: string, tokenType: string, expiresIn: number, refreshToken: string, refreshExpiresIn: number } };

export type RefreshTokenMutationVariables = Exact<{
  refreshToken: string;
}>;


export type RefreshTokenMutation = { refreshToken: { accessToken: string, tokenType: string, expiresIn: number, refreshToken: string, refreshExpiresIn: number } };

export type LogoutMutationVariables = Exact<{
  refreshToken: string;
}>;


export type LogoutMutation = { logout: boolean };

export const AuthTokensFragmentDoc = gql`
    fragment AuthTokens on AuthPayload {
  accessToken
  tokenType
  expiresIn
  refreshToken
  refreshExpiresIn
}
    `;
export const MeDocument = gql`
    query Me {
  me {
    id
    username
  }
}
    `;

export function useMeQuery(options?: Omit<Urql.UseQueryArgs<MeQueryVariables>, 'query'>) {
  return Urql.useQuery<MeQuery, MeQueryVariables>({ query: MeDocument, ...options });
};
export const RegisterDocument = gql`
    mutation Register($input: RegisterInput!) {
  register(input: $input) {
    ...AuthTokens
  }
}
    ${AuthTokensFragmentDoc}`;

export function useRegisterMutation() {
  return Urql.useMutation<RegisterMutation, RegisterMutationVariables>(RegisterDocument);
};
export const LoginDocument = gql`
    mutation Login($input: LoginInput!) {
  login(input: $input) {
    ...AuthTokens
  }
}
    ${AuthTokensFragmentDoc}`;

export function useLoginMutation() {
  return Urql.useMutation<LoginMutation, LoginMutationVariables>(LoginDocument);
};
export const RefreshTokenDocument = gql`
    mutation RefreshToken($refreshToken: String!) {
  refreshToken(refreshToken: $refreshToken) {
    ...AuthTokens
  }
}
    ${AuthTokensFragmentDoc}`;

export function useRefreshTokenMutation() {
  return Urql.useMutation<RefreshTokenMutation, RefreshTokenMutationVariables>(RefreshTokenDocument);
};
export const LogoutDocument = gql`
    mutation Logout($refreshToken: String!) {
  logout(refreshToken: $refreshToken)
}
    `;

export function useLogoutMutation() {
  return Urql.useMutation<LogoutMutation, LogoutMutationVariables>(LogoutDocument);
};