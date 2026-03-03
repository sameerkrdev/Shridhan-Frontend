import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  searchUser,
  addMember,
  listMembers,
  updateMemberRole,
  updateMemberStatus,
  removeMember,
  getUserProfile,
  updateUserProfile,
  listCustomRoles,
  createCustomRole,
  getRolePermissionMatrix,
  updateMatrixRolePermissions,
  getAssignableRoleOptions,
  getMyMemberships,
  leaveCurrentSociety,
} from "@/lib/membershipApi";
import type { MembershipStatus } from "@/types/auth";

export const useMembersQuery = (societyId: string | null, includeDeleted = false) => {
  return useQuery({
    queryKey: ["members", societyId, includeDeleted],
    queryFn: () => listMembers(societyId!, includeDeleted),
    enabled: Boolean(societyId),
  });
};

export const useSearchUserMutation = () => {
  return useMutation({ mutationFn: searchUser });
};

export const useAddMemberMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      userId?: string;
      emailOrPhone?: string;
      name?: string;
      email: string;
      phone?: string;
      roleId: string;
    }) => addMember(societyId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", societyId] });
    },
  });
};

export const useUpdateRoleMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, roleId }: { membershipId: string; roleId: string }) =>
      updateMemberRole(societyId, membershipId, roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", societyId] });
    },
  });
};

export const useUpdateStatusMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      membershipId,
      status,
    }: {
      membershipId: string;
      status: MembershipStatus;
    }) => updateMemberStatus(societyId, membershipId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", societyId] });
    },
  });
};

export const useRemoveMemberMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => removeMember(societyId, membershipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", societyId] });
    },
  });
};

export const useUserProfileQuery = () => {
  return useQuery({
    queryKey: ["user-profile"],
    queryFn: getUserProfile,
  });
};

export const useUpdateProfileMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
};

export const useMyMembershipsQuery = () => {
  return useQuery({
    queryKey: ["my-memberships"],
    queryFn: getMyMemberships,
  });
};

export const useLeaveSocietyMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (societyId: string) => leaveCurrentSociety(societyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
    },
  });
};

export const useCustomRolesQuery = (societyId: string | null) => {
  return useQuery({
    queryKey: ["custom-roles", societyId],
    queryFn: () => listCustomRoles(societyId!),
    enabled: Boolean(societyId),
  });
};

export const useCreateCustomRoleMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; permissions: string[] }) =>
      createCustomRole(societyId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["custom-roles", societyId] });
      void queryClient.invalidateQueries({ queryKey: ["role-permission-matrix", societyId] });
      void queryClient.invalidateQueries({ queryKey: ["assignable-role-options", societyId] });
    },
  });
};

export const useRolePermissionMatrixQuery = (societyId: string | null) => {
  return useQuery({
    queryKey: ["role-permission-matrix", societyId],
    queryFn: () => getRolePermissionMatrix(societyId!),
    enabled: Boolean(societyId),
  });
};

export const useUpdateMatrixRolePermissionsMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleKey, permissions }: { roleKey: string; permissions: string[] }) =>
      updateMatrixRolePermissions(societyId, roleKey, permissions),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["role-permission-matrix", societyId] });
    },
  });
};

export const useAssignableRoleOptionsQuery = (societyId: string | null) => {
  return useQuery({
    queryKey: ["assignable-role-options", societyId],
    queryFn: () => getAssignableRoleOptions(societyId!),
    enabled: Boolean(societyId),
  });
};
