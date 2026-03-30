import { apiClient } from "@/lib/apiClient";

export type PaymentMethod = "UPI" | "CASH" | "CHEQUE";
export type ServiceStatus = "PENDING_DEPOSIT" | "ACTIVE" | "COMPLETED" | "CLOSED";
export type RdInstallmentStatus = "PENDING" | "OVERDUE" | "PARTIAL" | "PAID";
export type SkipFinePolicy = "none" | "all" | "selected";

export interface RdProjectType {
  id: string;
  name: string;
  duration: number;
  minimumMonthlyAmount: string;
  maturityPerHundred: string;
  fineRatePerHundred: string;
  graceDays: number;
  penaltyMultiplier?: string | null;
  penaltyStartMonth?: number | null;
  isArchived?: boolean;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RdCustomer {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  aadhaar?: string | null;
  pan?: string | null;
}

export interface RdNominee {
  id: string;
  name: string;
  phone: string;
  relation?: string | null;
  address?: string | null;
  aadhaar?: string | null;
  pan?: string | null;
}

export interface RdInstallmentRow {
  id: string;
  monthIndex: number;
  dueDate: string;
  principalAmount: string;
  paidPrincipal: string;
  status: RdInstallmentStatus;
  remainingPrincipal: string;
  fine: string;
  totalDue: string;
  deferredFineAccrued: string;
  computedStatus: RdInstallmentStatus;
}

export interface RdTransaction {
  id: string;
  amount: string;
  principalAmount: string;
  fineAmount: string;
  type: "CREDIT" | "PAYOUT";
  paymentMethod?: PaymentMethod | null;
  transactionId?: string | null;
  upiId?: string | null;
  chequeNumber?: string | null;
  bankName?: string | null;
  createdAt: string;
  allocations?: Array<{
    id: string;
    installmentId: string;
    principalApplied: string;
    fineApplied: string;
  }>;
}

export interface RdAccount {
  id: string;
  monthlyAmount: string;
  totalPrincipalExpected: string;
  expectedMaturityPayout: string;
  startDate: string;
  maturityDate: string;
  status: ServiceStatus;
  isDeleted?: boolean;
  customer: RdCustomer;
  projectType: RdProjectType;
}

export interface RdDetail extends RdAccount {
  customer: RdCustomer & { nominees: RdNominee[] };
  installments: RdInstallmentRow[];
  transactions: RdTransaction[];
  summary: {
    totalOutstanding: string;
    expectedMaturityPayout: string;
    grossMaturityPayout: string;
    totalDeferredFines: string;
    netMaturityPayoutAfterDeferredFines: string;
    totalPrincipalExpected: string;
  };
}

export interface PaginatedRdAccounts {
  items: RdAccount[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RdReferrerMember {
  id: string;
  user: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
  };
  role: {
    id: string;
    name: string;
  };
}

export interface RdPreviewPayResponse {
  maxDue: string;
  amount: string;
  skipFinePolicy: SkipFinePolicy;
  skipFineMonths: number[];
  allocations: Array<{
    installmentId: string;
    monthIndex: number;
    principalApplied: string;
    fineApplied: string;
  }>;
  deferredFineDeltas: Array<{
    installmentId: string;
    monthIndex: number;
    deferredFineDelta: string;
  }>;
  unallocated: string;
  lines: Array<{
    installmentId: string;
    monthIndex: number;
    remainingPrincipal: string;
    fine: string;
    totalDue: string;
    overdue: boolean;
    status: RdInstallmentStatus;
  }>;
}

const societyHeader = (societyId: string) => ({
  headers: { "x-society-id": societyId },
});

export const createRdProjectType = async (
  societyId: string,
  payload: {
    name: string;
    duration: number;
    minimumMonthlyAmount: number;
    maturityPerHundred: number;
    fineRatePerHundred: number;
    graceDays: number;
    penaltyMultiplier?: number;
    penaltyStartMonth?: number;
  },
) => {
  const { data } = await apiClient.post<RdProjectType>("/recurring-deposits/project-types", payload, societyHeader(societyId));
  return data;
};

export const listRdProjectTypes = async (
  societyId: string,
  options?: { includeDeleted?: boolean; includeArchived?: boolean },
) => {
  const { data } = await apiClient.get<{ projectTypes: RdProjectType[] }>("/recurring-deposits/project-types", {
    ...societyHeader(societyId),
    params: {
      includeDeleted: options?.includeDeleted ? "true" : "false",
      includeArchived: options?.includeArchived ? "true" : "false",
    },
  });
  return data.projectTypes;
};

export const createRdAccount = async (
  societyId: string,
  payload: {
    referrerMembershipId?: string;
    customer: {
      fullName: string;
      phone: string;
      email?: string;
      address?: string;
      aadhaar?: string;
      pan?: string;
    };
    nominees: Array<{
      name: string;
      phone: string;
      relation?: string;
      address?: string;
      aadhaar?: string;
      pan?: string;
    }>;
    rd: {
      projectTypeId: string;
      monthlyAmount: number;
      startDate: string;
    };
    payment?: {
      amount?: number;
      paymentMethod?: PaymentMethod;
      transactionId?: string;
      upiId?: string;
      chequeNumber?: string;
      bankName?: string;
    };
  },
) => {
  const { data } = await apiClient.post("/recurring-deposits", payload, societyHeader(societyId));
  return data;
};

export const listRdReferrerMembers = async (societyId: string) => {
  const { data } = await apiClient.get<{ members: RdReferrerMember[] }>(
    "/recurring-deposits/referrers",
    societyHeader(societyId),
  );
  return data.members;
};

export const listRdAccounts = async (
  societyId: string,
  params: {
    page: number;
    pageSize: number;
    sortBy?: "id" | "customer_name" | "phone" | "monthly_amount" | "maturity_date" | "status";
    sortOrder?: "asc" | "desc";
    search?: string;
    includeDeleted?: boolean;
  },
) => {
  const { data } = await apiClient.get<PaginatedRdAccounts>("/recurring-deposits", {
    ...societyHeader(societyId),
    params: {
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      search: params.search?.trim() || undefined,
      includeDeleted: params.includeDeleted ? "true" : "false",
    },
  });
  return data;
};

export const getRdDetail = async (societyId: string, rdId: string) => {
  const { data } = await apiClient.get<RdDetail>(`/recurring-deposits/${rdId}`, societyHeader(societyId));
  return data;
};

export const previewRdPayment = async (
  societyId: string,
  rdId: string,
  payload: {
    amount?: number;
    months?: number[];
    skipFinePolicy?: SkipFinePolicy;
    skipFineMonths?: number[];
  },
) => {
  const { data } = await apiClient.post<RdPreviewPayResponse>(
    `/recurring-deposits/${rdId}/preview-pay`,
    payload,
    societyHeader(societyId),
  );
  return data;
};

export const payRd = async (
  societyId: string,
  rdId: string,
  payload: {
    amount: number;
    months?: number[];
    skipFinePolicy?: SkipFinePolicy;
    skipFineMonths?: number[];
    paymentMethod?: PaymentMethod;
    transactionId?: string;
    upiId?: string;
    bankName?: string;
    chequeNumber?: string;
  },
) => {
  const { data } = await apiClient.post(`/recurring-deposits/${rdId}/pay`, payload, societyHeader(societyId));
  return data;
};

export const withdrawRd = async (
  societyId: string,
  rdId: string,
  payload?: {
    deductDeferredFinesFromMaturity?: boolean;
    paymentMethod?: PaymentMethod;
    transactionId?: string;
    upiId?: string;
    bankName?: string;
    chequeNumber?: string;
  },
) => {
  const { data } = await apiClient.post(`/recurring-deposits/${rdId}/withdraw`, payload ?? {}, societyHeader(societyId));
  return data;
};

export const deleteRdProjectType = async (societyId: string, projectTypeId: string) => {
  const { data } = await apiClient.delete<{ success: boolean }>(
    `/recurring-deposits/project-types/${projectTypeId}`,
    societyHeader(societyId),
  );
  return data;
};

export const deleteRdAccount = async (societyId: string, rdId: string) => {
  const { data } = await apiClient.delete<{ success: boolean }>(`/recurring-deposits/${rdId}`, societyHeader(societyId));
  return data;
};
