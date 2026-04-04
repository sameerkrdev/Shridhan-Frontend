import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRdAccount,
  createRdFineWaiveRequest,
  createRdProjectType,
  deleteRdAccount,
  deleteRdProjectType,
  getRdDetail,
  listRdFineWaiveRequests,
  listPendingRdFineWaiveRequests,
  listRdAccounts,
  listRdReferrerMembers,
  listRdProjectTypes,
  payRd,
  previewRdPayment,
  approveRdFineWaiveRequest,
  rejectRdFineWaiveRequest,
  updateRdAccount,
  withdrawRd,
  type RdFineCalculationMethod,
} from "@/lib/rdApi";

export const useRdProjectTypesQuery = (
  societyId: string | null,
  options?: { includeDeleted?: boolean; includeArchived?: boolean },
) => {
  return useQuery({
    queryKey: [
      "rd-project-types",
      societyId,
      options?.includeDeleted ? "with-deleted" : "active-only",
      options?.includeArchived ? "with-archived" : "active-only",
    ],
    queryFn: () => listRdProjectTypes(societyId!, options),
    enabled: Boolean(societyId),
  });
};

export const useRdAccountsQuery = (
  societyId: string | null,
  params: {
    page: number;
    pageSize: number;
    sortBy?: "id" | "customer_name" | "phone" | "monthly_amount" | "maturity_date" | "status";
    sortOrder?: "asc" | "desc";
    search?: string;
    includeDeleted?: boolean;
  },
) => {
  return useQuery({
    queryKey: [
      "rd-accounts",
      societyId,
      params.page,
      params.pageSize,
      params.sortBy ?? "maturity_date",
      params.sortOrder ?? "desc",
      params.search ?? "",
      params.includeDeleted ? "with-deleted" : "active-only",
    ],
    queryFn: () => listRdAccounts(societyId!, params),
    enabled: Boolean(societyId),
  });
};

export const useRdDetailQuery = (societyId: string | null, rdId: string | null, enabled = true) => {
  return useQuery({
    queryKey: ["rd-detail", societyId, rdId],
    queryFn: () => getRdDetail(societyId!, rdId!),
    enabled: Boolean(societyId && rdId && enabled),
  });
};

export const useCreateRdProjectTypeMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      duration: number;
      minimumMonthlyAmount: number;
      maturityPerHundred: number;
      fineCalculationMethod: RdFineCalculationMethod;
      fixedOverdueFineAmount?: number;
      fineRatePerHundred?: number;
      graceDays: number;
      penaltyMultiplier?: number;
      penaltyStartMonth?: number;
    }) => createRdProjectType(societyId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rd-project-types", societyId] });
    },
  });
};

export const useCreateRdAccountMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRdAccount.bind(null, societyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rd-project-types", societyId] });
      void queryClient.invalidateQueries({ queryKey: ["rd-accounts", societyId] });
    },
  });
};

export const useUpdateRdAccountMutation = (societyId: string, rdId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof updateRdAccount>[2]) =>
      updateRdAccount(societyId, rdId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rd-detail", societyId, rdId] });
      void queryClient.invalidateQueries({ queryKey: ["rd-accounts", societyId] });
    },
  });
};

export const useRdReferrerMembersQuery = (societyId: string | null) => {
  return useQuery({
    queryKey: ["rd-referrer-members", societyId],
    queryFn: () => listRdReferrerMembers(societyId!),
    enabled: Boolean(societyId),
  });
};

export const usePreviewRdPaymentMutation = (societyId: string, rdId: string) => {
  return useMutation({
    mutationFn: (payload: {
      amount?: number;
      months?: number[];
      skipFinePolicy?: "none" | "all" | "selected";
      skipFineMonths?: number[];
      waiveRequestId?: string;
    }) => previewRdPayment(societyId, rdId, payload),
  });
};

export const usePayRdMutation = (societyId: string, rdId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      amount: number;
      months?: number[];
      skipFinePolicy?: "none" | "all" | "selected";
      skipFineMonths?: number[];
      waiveRequestId?: string;
      paymentMethod?: "UPI" | "CASH" | "CHEQUE";
      transactionId?: string;
      upiId?: string;
      bankName?: string;
      chequeNumber?: string;
    }) => payRd(societyId, rdId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rd-detail", societyId, rdId] });
      void queryClient.invalidateQueries({ queryKey: ["rd-accounts", societyId] });
    },
  });
};

export const usePayRdForAnyMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      rdId: string;
      amount: number;
      months?: number[];
      skipFinePolicy?: "none" | "all" | "selected";
      skipFineMonths?: number[];
      waiveRequestId?: string;
      paymentMethod?: "UPI" | "CASH" | "CHEQUE";
      transactionId?: string;
      upiId?: string;
      bankName?: string;
      chequeNumber?: string;
    }) => {
      const { rdId, ...payload } = variables;
      return payRd(societyId, rdId, payload);
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["rd-detail", societyId, variables.rdId] });
      void queryClient.invalidateQueries({ queryKey: ["rd-accounts", societyId] });
    },
  });
};

export const useWithdrawRdMutation = (societyId: string, rdId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload?: {
      deductDeferredFinesFromMaturity?: boolean;
      fineDeductionMode?: "all" | "marked_only";
      paymentMethod?: "UPI" | "CASH" | "CHEQUE";
      transactionId?: string;
      upiId?: string;
      bankName?: string;
      chequeNumber?: string;
    }) => withdrawRd(societyId, rdId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rd-detail", societyId, rdId] });
      void queryClient.invalidateQueries({ queryKey: ["rd-accounts", societyId] });
    },
  });
};

export const useRdFineWaiveRequestsQuery = (
  societyId: string | null,
  rdId: string | null,
  enabled = true,
) => {
  return useQuery({
    queryKey: ["rd-fine-waive-requests", societyId, rdId],
    queryFn: () => listRdFineWaiveRequests(societyId!, rdId!),
    enabled: Boolean(societyId && rdId && enabled),
  });
};

export const usePendingRdFineWaiveRequestsQuery = (societyId: string | null, enabled = true) => {
  return useQuery({
    queryKey: ["rd-fine-waive-requests-pending", societyId],
    queryFn: () => listPendingRdFineWaiveRequests(societyId!),
    enabled: Boolean(societyId && enabled),
  });
};

export const useCreateRdFineWaiveRequestMutation = (societyId: string, rdId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      scopeType: "all" | "selected";
      months?: number[];
      ttlDays?: number;
      expiresAt?: string;
      reduceFromMaturity?: boolean;
      reason?: string;
      autoApprove?: boolean;
    }) => createRdFineWaiveRequest(societyId, rdId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rd-fine-waive-requests", societyId, rdId] });
      void queryClient.invalidateQueries({ queryKey: ["rd-detail", societyId, rdId] });
    },
  });
};

export const useApproveRdFineWaiveRequestMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => approveRdFineWaiveRequest(societyId, requestId),
    onSuccess: (request) => {
      void queryClient.invalidateQueries({
        queryKey: ["rd-fine-waive-requests", societyId, request.recurringDepositId],
      });
      void queryClient.invalidateQueries({ queryKey: ["rd-detail", societyId, request.recurringDepositId] });
    },
  });
};

export const useRejectRdFineWaiveRequestMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { requestId: string; rejectionReason?: string }) =>
      rejectRdFineWaiveRequest(societyId, payload.requestId, { rejectionReason: payload.rejectionReason }),
    onSuccess: (request) => {
      void queryClient.invalidateQueries({
        queryKey: ["rd-fine-waive-requests", societyId, request.recurringDepositId],
      });
      void queryClient.invalidateQueries({ queryKey: ["rd-detail", societyId, request.recurringDepositId] });
    },
  });
};

export const useDeleteRdProjectTypeMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectTypeId: string) => deleteRdProjectType(societyId, projectTypeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rd-project-types", societyId] });
    },
  });
};

export const useDeleteRdAccountMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rdId: string) => deleteRdAccount(societyId, rdId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rd-accounts", societyId] });
      void queryClient.invalidateQueries({ queryKey: ["rd-detail", societyId] });
    },
  });
};
