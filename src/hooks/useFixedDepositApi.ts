import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addTransaction,
  approveFdEarlyPayoutRequest,
  completeFdDocumentUpload,
  createFdAccount,
  createFdEarlyPayoutRequest,
  createProjectType,
  deleteFdAccount,
  deleteProjectType,
  getFdDetail,
  listFdEarlyPayoutRequests,
  listFdReferrerMembers,
  listFdAccounts,
  listPendingFdEarlyPayoutRequests,
  listProjectTypes,
  rejectFdEarlyPayoutRequest,
  requestFdDocumentUploadUrl,
  updateFdAccount,
  updateFdStatus,
  updateProjectTypeStatus,
  type MaturityCalculationMethod,
} from "@/lib/fixedDepositApi";

export const useProjectTypesQuery = (societyId: string | null, includeDeleted = false) => {
  return useQuery({
    queryKey: ["fd-project-types", societyId, includeDeleted ? "with-deleted" : "active-only"],
    queryFn: () => listProjectTypes(societyId!, includeDeleted),
    enabled: Boolean(societyId),
  });
};

export const useFdAccountsQuery = (
  societyId: string | null,
  sorting?: {
    sortBy?:
      | "id"
      | "customer_name"
      | "phone"
      | "plan"
      | "status"
      | "principal_amount"
      | "maturity_amount"
      | "start_date"
      | "maturity_date";
    sortOrder?: "asc" | "desc";
  },
  includeDeleted = false,
  search?: string,
) => {
  return useQuery({
    queryKey: [
      "fd-accounts",
      societyId,
      sorting?.sortBy ?? "maturity_date",
      sorting?.sortOrder ?? "desc",
      includeDeleted ? "with-deleted" : "active-only",
      search ?? "",
    ],
    queryFn: () => listFdAccounts(societyId!, sorting, includeDeleted, search),
    enabled: Boolean(societyId),
  });
};

export const useFdDetailQuery = (societyId: string | null, fdId: string | null, enabled = true) => {
  return useQuery({
    queryKey: ["fd-detail", societyId, fdId],
    queryFn: () => getFdDetail(societyId!, fdId!),
    enabled: Boolean(societyId && fdId && enabled),
  });
};

export const useCreateProjectTypeMutation = (societyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      duration: number;
      minimumAmount: number;
      maturityCalculationMethod: MaturityCalculationMethod;
      maturityValue: number;
    }) => createProjectType(societyId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fd-project-types", societyId] });
    },
  });
};

export const useCreateFdAccountMutation = (societyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFdAccount.bind(null, societyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fd-accounts", societyId] });
      void queryClient.invalidateQueries({ queryKey: ["fd-project-types", societyId] });
    },
  });
};

export const useUpdateFdAccountMutation = (societyId: string, fdId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof updateFdAccount>[2]) =>
      updateFdAccount(societyId, fdId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fd-detail", societyId, fdId] });
      void queryClient.invalidateQueries({ queryKey: ["fd-accounts", societyId] });
    },
  });
};

export const useFdReferrerMembersQuery = (societyId: string | null) => {
  return useQuery({
    queryKey: ["fd-referrer-members", societyId],
    queryFn: () => listFdReferrerMembers(societyId!),
    enabled: Boolean(societyId),
  });
};

export const useAddTransactionMutation = (societyId: string, fdId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      type: "CREDIT" | "PAYOUT";
      amount: number;
      paymentMethod?: "UPI" | "CASH" | "CHEQUE";
      transactionId?: string;
      upiId?: string;
      bankName?: string;
      chequeNumber?: string;
      month?: number;
      fdEarlyPayoutRequestId?: string;
    }) => addTransaction(societyId, fdId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["fd-detail", societyId, fdId], data.fdDetail);
      void queryClient.invalidateQueries({ queryKey: ["fd-accounts", societyId] });
      void queryClient.invalidateQueries({ queryKey: ["fd-early-payout-requests", societyId, fdId] });
    },
  });
};

export const useAddTransactionForAnyFdMutation = (societyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      fdId: string;
      type: "CREDIT" | "PAYOUT";
      amount: number;
      paymentMethod?: "UPI" | "CASH" | "CHEQUE";
      transactionId?: string;
      upiId?: string;
      bankName?: string;
      chequeNumber?: string;
      month?: number;
      fdEarlyPayoutRequestId?: string;
    }) => {
      const { fdId, ...transactionPayload } = payload;
      return addTransaction(societyId, fdId, transactionPayload);
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["fd-detail", societyId, variables.fdId], data.fdDetail);
      void queryClient.invalidateQueries({ queryKey: ["fd-accounts", societyId] });
      void queryClient.invalidateQueries({
        queryKey: ["fd-early-payout-requests", societyId, variables.fdId],
      });
    },
  });
};

export const useFdEarlyPayoutRequestsQuery = (
  societyId: string | null,
  fdId: string | null,
  enabled = true,
) => {
  return useQuery({
    queryKey: ["fd-early-payout-requests", societyId, fdId],
    queryFn: () => listFdEarlyPayoutRequests(societyId!, fdId!),
    enabled: Boolean(societyId && fdId && enabled),
  });
};

export const usePendingFdEarlyPayoutRequestsQuery = (
  societyId: string | null,
  enabled = true,
) => {
  return useQuery({
    queryKey: ["fd-early-payout-requests-pending", societyId],
    queryFn: () => listPendingFdEarlyPayoutRequests(societyId!),
    enabled: Boolean(societyId && enabled),
  });
};

export const useCreateFdEarlyPayoutRequestMutation = (societyId: string, fdId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createFdEarlyPayoutRequest>[2]) =>
      createFdEarlyPayoutRequest(societyId, fdId, payload),
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: ["fd-early-payout-requests", societyId, fdId] });
      void queryClient.invalidateQueries({ queryKey: ["fd-early-payout-requests-pending", societyId] });
      const fdDetail = await getFdDetail(societyId, fdId);
      queryClient.setQueryData(["fd-detail", societyId, fdId], fdDetail);
      void queryClient.invalidateQueries({ queryKey: ["fd-accounts", societyId] });
    },
  });
};

export const useApproveFdEarlyPayoutRequestMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { requestId: string; recalculatePrincipalAndMaturity?: boolean }) =>
      approveFdEarlyPayoutRequest(societyId, args.requestId, {
        ...(args.recalculatePrincipalAndMaturity !== undefined
          ? { recalculatePrincipalAndMaturity: args.recalculatePrincipalAndMaturity }
          : {}),
      }),
    onSuccess: async (request) => {
      void queryClient.invalidateQueries({
        queryKey: ["fd-early-payout-requests", societyId, request.fixDepositId],
      });
      void queryClient.invalidateQueries({ queryKey: ["fd-early-payout-requests-pending", societyId] });
      const fdDetail = await getFdDetail(societyId, request.fixDepositId);
      queryClient.setQueryData(["fd-detail", societyId, request.fixDepositId], fdDetail);
      void queryClient.invalidateQueries({ queryKey: ["fd-accounts", societyId] });
    },
  });
};

export const useRejectFdEarlyPayoutRequestMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { requestId: string; rejectionReason?: string }) =>
      rejectFdEarlyPayoutRequest(societyId, payload.requestId, {
        rejectionReason: payload.rejectionReason,
      }),
    onSuccess: async (request) => {
      void queryClient.invalidateQueries({
        queryKey: ["fd-early-payout-requests", societyId, request.fixDepositId],
      });
      void queryClient.invalidateQueries({ queryKey: ["fd-early-payout-requests-pending", societyId] });
      const fdDetail = await getFdDetail(societyId, request.fixDepositId);
      queryClient.setQueryData(["fd-detail", societyId, request.fixDepositId], fdDetail);
      void queryClient.invalidateQueries({ queryKey: ["fd-accounts", societyId] });
    },
  });
};

export const useUpdateFdStatusMutation = (societyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { fdId: string; status: "ACTIVE" | "COMPLETED" | "CLOSED" }) =>
      updateFdStatus(societyId, payload.fdId, { status: payload.status }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["fd-accounts", societyId] });
      void queryClient.invalidateQueries({ queryKey: ["fd-detail", societyId, variables.fdId] });
    },
  });
};

export const useUpdateProjectTypeStatusMutation = (societyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { projectTypeId: string; status: "ACTIVE" | "SUSPENDED" }) =>
      updateProjectTypeStatus(societyId, payload.projectTypeId, { status: payload.status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fd-project-types", societyId] });
      void queryClient.invalidateQueries({ queryKey: ["fd-accounts", societyId] });
    },
  });
};

export const useDeleteProjectTypeMutation = (societyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectTypeId: string) => deleteProjectType(societyId, projectTypeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fd-project-types", societyId] });
      void queryClient.invalidateQueries({ queryKey: ["fd-accounts", societyId] });
    },
  });
};

export const useDeleteFdAccountMutation = (societyId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fdId: string) => deleteFdAccount(societyId, fdId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fd-accounts", societyId] });
    },
  });
};

export const useRequestFdDocumentUploadUrlMutation = (societyId: string, fdId: string) => {
  return useMutation({
    mutationFn: (payload: {
      fileName: string;
      displayName: string;
      contentType?: string;
      sizeBytes?: number;
    }) => requestFdDocumentUploadUrl(societyId, fdId, payload),
  });
};

export const useCompleteFdDocumentUploadMutation = (societyId: string, fdId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => completeFdDocumentUpload(societyId, fdId, documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fd-detail", societyId, fdId] });
    },
  });
};
