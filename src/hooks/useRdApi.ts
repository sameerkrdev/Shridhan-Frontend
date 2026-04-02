import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRdAccount,
  createRdProjectType,
  deleteRdAccount,
  deleteRdProjectType,
  getRdDetail,
  listRdAccounts,
  listRdReferrerMembers,
  listRdProjectTypes,
  payRd,
  previewRdPayment,
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
    }) =>
      previewRdPayment(societyId, rdId, payload),
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
