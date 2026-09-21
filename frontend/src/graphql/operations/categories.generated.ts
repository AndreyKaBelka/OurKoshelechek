// @ts-nocheck
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import * as Types from '../types';

import gql from 'graphql-tag';
import * as Urql from 'urql';
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type CreateCategoryInput = {
  /** Иконка категории (эмодзи). */
  icon: string;
  monthlyLimit?: MoneyInput | null | undefined;
  name: string;
};

export type MoneyInput = {
  /** Сумма в минимальных единицах валюты (копейках). */
  amount: number;
};

export type UpdateCategoryInput = {
  icon?: string | null | undefined;
  monthlyLimit?: MoneyInput | null | undefined;
  name?: string | null | undefined;
};

export type CategoriesQueryVariables = Exact<{
  groupId: string;
}>;


export type CategoriesQuery = { categories: Array<{ id: string, icon: string, name: string, monthlyLimit: { amount: number } | null }> };

export type CreateCategoryMutationVariables = Exact<{
  groupId: string;
  input: Types.CreateCategoryInput;
}>;


export type CreateCategoryMutation = { createCategory: { id: string, icon: string, name: string, monthlyLimit: { amount: number } | null } };

export type UpdateCategoryMutationVariables = Exact<{
  groupId: string;
  categoryId: string;
  input: Types.UpdateCategoryInput;
}>;


export type UpdateCategoryMutation = { updateCategory: { id: string, icon: string, name: string, monthlyLimit: { amount: number } | null } };

export type DeleteCategoryMutationVariables = Exact<{
  groupId: string;
  categoryId: string;
}>;


export type DeleteCategoryMutation = { deleteCategory: boolean };


export const CategoriesDocument = gql`
    query Categories($groupId: UUID!) {
  categories(groupId: $groupId) {
    id
    icon
    name
    monthlyLimit {
      amount
    }
  }
}
    `;

export function useCategoriesQuery(options: Omit<Urql.UseQueryArgs<CategoriesQueryVariables>, 'query'>) {
  return Urql.useQuery<CategoriesQuery, CategoriesQueryVariables>({ query: CategoriesDocument, ...options });
};
export const CreateCategoryDocument = gql`
    mutation CreateCategory($groupId: UUID!, $input: CreateCategoryInput!) {
  createCategory(groupId: $groupId, input: $input) {
    id
    icon
    name
    monthlyLimit {
      amount
    }
  }
}
    `;

export function useCreateCategoryMutation() {
  return Urql.useMutation<CreateCategoryMutation, CreateCategoryMutationVariables>(CreateCategoryDocument);
};
export const UpdateCategoryDocument = gql`
    mutation UpdateCategory($groupId: UUID!, $categoryId: UUID!, $input: UpdateCategoryInput!) {
  updateCategory(groupId: $groupId, categoryId: $categoryId, input: $input) {
    id
    icon
    name
    monthlyLimit {
      amount
    }
  }
}
    `;

export function useUpdateCategoryMutation() {
  return Urql.useMutation<UpdateCategoryMutation, UpdateCategoryMutationVariables>(UpdateCategoryDocument);
};
export const DeleteCategoryDocument = gql`
    mutation DeleteCategory($groupId: UUID!, $categoryId: UUID!) {
  deleteCategory(groupId: $groupId, categoryId: $categoryId)
}
    `;

export function useDeleteCategoryMutation() {
  return Urql.useMutation<DeleteCategoryMutation, DeleteCategoryMutationVariables>(DeleteCategoryDocument);
};