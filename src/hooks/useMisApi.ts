import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMisDeposit,
  completeMisDocumentUpload,
  createMisAccount,
  createMisProjectType,
  deleteMisAccount,
  deleteMisProjectType,
  getMisDetail,
  listMisReferrerMembers,
  listMisAccounts,
  listMisProjectTypes,
  payMisInterest,
  requestMisDocumentUploadUrl,
  returnMisPrincipal,
} from "@/lib/misApi";

export const useMisProjectTypesQuery = (
  societyId: string | null,
  options?: { includeDeleted?: boolean; includeArchived?: boolean },
) => {
  return useQuery({
    queryKey: [
      "mis-project-types",
      societyId,
      options?.includeDeleted ? "with-deleted" : "active-only",
      options?.includeArchived ? "with-archived" : "active-only",
    ],
    queryFn: () => listMisProjectTypes(societyId!, options),
    enabled: Boolean(societyId),
  });
};

export const useMisAccountsQuery = (
  societyId: string | null,
  params: {
    page: number;
    pageSize: number;
    sortBy?: "id" | "customer_name" | "phone" | "deposit_amount" | "monthly_interest" | "maturity_date" | "status";
    sortOrder?: "asc" | "desc";
    search?: string;
    includeDeleted?: boolean;
  },
) => {
  return useQuery({
    queryKey: [
      "mis-accounts",
      societyId,
      params.page,
      params.pageSize,
      params.sortBy ?? "maturity_date",
      params.sortOrder ?? "desc",
      params.search ?? "",
      params.includeDeleted ? "with-deleted" : "active-only",
    ],
    queryFn: () => listMisAccounts(societyId!, params),
    enabled: Boolean(societyId),
  });
};

export const useMisDetailQuery = (societyId: string | null, misId: string | null, enabled = true) => {
  return useQuery({
    queryKey: ["mis-detail", societyId, misId],
    queryFn: () => getMisDetail(societyId!, misId!),
    enabled: Boolean(societyId && misId && enabled),
  });
};

export const useCreateMisProjectTypeMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      duration: number;
      minimumAmount: number;
      monthlyInterestRate?: number;
      monthlyInterestPerLakh?: number;
      rules?: string;
    }) => createMisProjectType(societyId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mis-project-types", societyId] });
    },
  });
};

export const useCreateMisAccountMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMisAccount.bind(null, societyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mis-project-types", societyId] });
      void queryClient.invalidateQueries({ queryKey: ["mis-accounts", societyId] });
    },
  });
};

export const useMisReferrerMembersQuery = (societyId: string | null) => {
  return useQuery({
    queryKey: ["mis-referrer-members", societyId],
    queryFn: () => listMisReferrerMembers(societyId!),
    enabled: Boolean(societyId),
  });
};

export const useAddMisDepositMutation = (societyId: string, misId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      amount: number;
      paymentMethod?: "UPI" | "CASH" | "CHEQUE";
      transactionId?: string;
      upiId?: string;
      bankName?: string;
      chequeNumber?: string;
    }) => addMisDeposit(societyId, misId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mis-detail", societyId, misId] });
      void queryClient.invalidateQueries({ queryKey: ["mis-accounts", societyId] });
    },
  });
};

export const usePayMisInterestMutation = (societyId: string, misId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      month?: number;
      months?: number[];
      amount: number;
      paymentMethod?: "UPI" | "CASH" | "CHEQUE";
      transactionId?: string;
      upiId?: string;
      bankName?: string;
      chequeNumber?: string;
    }) => payMisInterest(societyId, misId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mis-detail", societyId, misId] });
      void queryClient.invalidateQueries({ queryKey: ["mis-accounts", societyId] });
    },
  });
};

export const useReturnMisPrincipalMutation = (societyId: string, misId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload?: {
      paymentMethod?: "UPI" | "CASH" | "CHEQUE";
      transactionId?: string;
      upiId?: string;
      bankName?: string;
      chequeNumber?: string;
    }) => returnMisPrincipal(societyId, misId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mis-detail", societyId, misId] });
      void queryClient.invalidateQueries({ queryKey: ["mis-accounts", societyId] });
    },
  });
};

export const useDeleteMisProjectTypeMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectTypeId: string) => deleteMisProjectType(societyId, projectTypeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mis-project-types", societyId] });
    },
  });
};

export const useDeleteMisAccountMutation = (societyId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (misId: string) => deleteMisAccount(societyId, misId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mis-accounts", societyId] });
      void queryClient.invalidateQueries({ queryKey: ["mis-detail", societyId] });
    },
  });
};

export const useRequestMisDocumentUploadUrlMutation = (societyId: string, misId: string) => {
  return useMutation({
    mutationFn: (payload: {
      fileName: string;
      displayName: string;
      contentType?: string;
      sizeBytes?: number;
    }) => requestMisDocumentUploadUrl(societyId, misId, payload),
  });
};

export const useCompleteMisDocumentUploadMutation = (societyId: string, misId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => completeMisDocumentUpload(societyId, misId, documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mis-detail", societyId, misId] });
    },
  });
};
