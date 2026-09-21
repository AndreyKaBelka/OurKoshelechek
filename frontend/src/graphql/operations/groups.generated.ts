// @ts-nocheck
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import * as Types from '../types';

import gql from 'graphql-tag';
import * as Urql from 'urql';
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type CreateGroupInput = {
  name: string;
};

export type GroupRole =
  | 'MEMBER'
  | 'OWNER';

/** ⚠️ зависит от решения: добавление по username, либо по email с генерацией инвайт-кода. */
export type InviteMemberInput = {
  email?: string | null | undefined;
  username?: string | null | undefined;
};

export type UpdateGroupInput = {
  name: string;
};

export type GroupsQueryVariables = Exact<{ [key: string]: never; }>;


export type GroupsQuery = { groups: Array<{ id: string, name: string, membersCount: number }> };

export type GroupQueryVariables = Exact<{
  groupId: string;
}>;


export type GroupQuery = { group: { id: string, name: string, members: Array<{ role: Types.GroupRole | null, user: { id: string, username: string } }> } | null };

export type CreateGroupMutationVariables = Exact<{
  input: Types.CreateGroupInput;
}>;


export type CreateGroupMutation = { createGroup: { id: string, name: string, members: Array<{ role: Types.GroupRole | null, user: { id: string, username: string } }> } };

export type UpdateGroupMutationVariables = Exact<{
  groupId: string;
  input: Types.UpdateGroupInput;
}>;


export type UpdateGroupMutation = { updateGroup: { id: string, name: string } };

export type InviteMemberMutationVariables = Exact<{
  groupId: string;
  input: Types.InviteMemberInput;
}>;


export type InviteMemberMutation = { inviteMember: { inviteId: string | null, memberId: string | null } };

export type RemoveMemberMutationVariables = Exact<{
  groupId: string;
  userId: string;
}>;


export type RemoveMemberMutation = { removeMember: boolean };


export const GroupsDocument = gql`
    query Groups {
  groups {
    id
    name
    membersCount
  }
}
    `;

export function useGroupsQuery(options?: Omit<Urql.UseQueryArgs<GroupsQueryVariables>, 'query'>) {
  return Urql.useQuery<GroupsQuery, GroupsQueryVariables>({ query: GroupsDocument, ...options });
};
export const GroupDocument = gql`
    query Group($groupId: UUID!) {
  group(groupId: $groupId) {
    id
    name
    members {
      role
      user {
        id
        username
      }
    }
  }
}
    `;

export function useGroupQuery(options: Omit<Urql.UseQueryArgs<GroupQueryVariables>, 'query'>) {
  return Urql.useQuery<GroupQuery, GroupQueryVariables>({ query: GroupDocument, ...options });
};
export const CreateGroupDocument = gql`
    mutation CreateGroup($input: CreateGroupInput!) {
  createGroup(input: $input) {
    id
    name
    members {
      role
      user {
        id
        username
      }
    }
  }
}
    `;

export function useCreateGroupMutation() {
  return Urql.useMutation<CreateGroupMutation, CreateGroupMutationVariables>(CreateGroupDocument);
};
export const UpdateGroupDocument = gql`
    mutation UpdateGroup($groupId: UUID!, $input: UpdateGroupInput!) {
  updateGroup(groupId: $groupId, input: $input) {
    id
    name
  }
}
    `;

export function useUpdateGroupMutation() {
  return Urql.useMutation<UpdateGroupMutation, UpdateGroupMutationVariables>(UpdateGroupDocument);
};
export const InviteMemberDocument = gql`
    mutation InviteMember($groupId: UUID!, $input: InviteMemberInput!) {
  inviteMember(groupId: $groupId, input: $input) {
    inviteId
    memberId
  }
}
    `;

export function useInviteMemberMutation() {
  return Urql.useMutation<InviteMemberMutation, InviteMemberMutationVariables>(InviteMemberDocument);
};
export const RemoveMemberDocument = gql`
    mutation RemoveMember($groupId: UUID!, $userId: UUID!) {
  removeMember(groupId: $groupId, userId: $userId)
}
    `;

export function useRemoveMemberMutation() {
  return Urql.useMutation<RemoveMemberMutation, RemoveMemberMutationVariables>(RemoveMemberDocument);
};