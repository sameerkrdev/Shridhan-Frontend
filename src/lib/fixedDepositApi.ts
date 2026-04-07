import { apiClient } from "@/lib/apiClient";

export type PaymentMethod = "UPI" | "CASH" | "CHEQUE";
export type TransactionType = "CREDIT" | "PAYOUT";
export type ServiceStatus = "ACTIVE" | "COMPLETED" | "CLOSED";

export type MaturityCalculationMethod =
  | "PER_RS_100"
  | "MULTIPLE_OF_PRINCIPAL"
  | "INTEREST_MATURITY"
  | "SIMPLE_INTEREST"
  | "COMPOUNDING_INTEREST";

export interface FixedDepositProjectType {
  id: string;
  name: string;
  duration: number;
  minimumAmount: string;
  maturityMultiple: string;
  maturityAmountPerHundred: string;
  maturityCalculationMethod?: MaturityCalculationMethod;
  societyId: string;
  isArchived?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FixedDepositCustomer {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  aadhaar?: string | null;
  pan?: string | null;
}

export interface FixedDepositNominee {
  id: string;
  name: string;
  phone: string;
  relation?: string | null;
  address?: string | null;
  aadhaar?: string | null;
  pan?: string | null;
}

export interface FixedDepositTransaction {
  id: string;
  type: TransactionType;
  amount: string;
  month?: number | null;
  paymentMethod?: PaymentMethod | null;
  transactionId?: string | null;
  upiId?: string | null;
  chequeNumber?: string | null;
  bankName?: string | null;
  createdAt: string;
}

export interface FixedDepositAccount {
  id: string;
  /** Opening / agreed principal; unchanged by early-payout principal recalculation. */
  originalPrincipalAmount?: string;
  /** Opening / agreed maturity amount; unchanged by early-payout principal recalculation. */
  originalMaturityAmount?: string;
  /** Current book principal (may be reduced after approved early payout with recalculation). */
  principalAmount: string;
  startDate: string;
  maturityDate: string;
  maturityAmount: string;
  status: ServiceStatus;
  isDeleted?: boolean;
  deletedAt?: string | null;
  customer: FixedDepositCustomer;
  projectType: FixedDepositProjectType;
  transactions?: FixedDepositTransaction[];
  uploadTargets?: Array<{
    documentId: string;
    displayName: string;
    fileName: string;
    uploadUrl: string;
    fileUrl: string;
  }>;
}

export interface FixedDepositDetail extends FixedDepositAccount {
  customer: FixedDepositCustomer & {
    nominees: FixedDepositNominee[];
  };
  transactions: FixedDepositTransaction[];
  documents?: FixedDepositDocument[];
}

export interface FixedDepositDocument {
  id: string;
  fileName: string;
  displayName: string;
  objectKey: string;
  fileUrl: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  isUploaded: boolean;
  createdAt: string;
}

export interface ReferrerMember {
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

export interface CreateProjectTypePayload {
  name: string;
  duration: number;
  minimumAmount: number;
  maturityCalculationMethod: MaturityCalculationMethod;
  maturityValue: number;
}

export interface CreateFdAccountPayload {
  referrerMembershipId: string;
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
  fd: {
    projectTypeId: string;
    depositAmount: number;
    startDate: string;
    initialPaymentAmount?: number;
  };
  payment: {
    paymentMethod?: PaymentMethod;
    transactionId?: string;
    upiId?: string;
    chequeNumber?: string;
    bankName?: string;
  };
  documents?: Array<{
    fileName: string;
    displayName: string;
    contentType?: string;
    sizeBytes?: number;
  }>;
}

export interface UpdateFdAccountPayload {
  customer: CreateFdAccountPayload["customer"];
  nominees: CreateFdAccountPayload["nominees"];
  documents?: {
    updates?: Array<{ id: string; displayName: string }>;
    deleteIds?: string[];
  };
}

export interface AddTransactionPayload {
  type: TransactionType;
  amount: number;
  paymentMethod?: PaymentMethod;
  transactionId?: string;
  upiId?: string;
  bankName?: string;
  chequeNumber?: string;
  month?: number;
  fdEarlyPayoutRequestId?: string;
}

export type FdEarlyPayoutRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "INVALIDATED";

export interface FdEarlyPayoutRequest {
  id: string;
  fixDepositId: string;
  requestedByMembershipId: string;
  amount: string;
  reason: string | null;
  expiresAt: string;
  status: FdEarlyPayoutRequestStatus;
  recalculatePrincipalAndMaturity: boolean;
  approvedByMembershipId: string | null;
  approvedAt: string | null;
  rejectedByMembershipId: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  invalidationReason: string | null;
  linkedTransactions?: Array<{ id: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFdEarlyPayoutRequestPayload {
  amount: number;
  ttlDays?: number;
  expiresAt?: string;
  recalculatePrincipalAndMaturity?: boolean;
  reason?: string;
  /** When you can approve, set true to create PENDING for others instead of auto-approve. */
  submitForApproverReview?: boolean;
}

export interface UpdateFdStatusPayload {
  status: ServiceStatus;
}

export interface UpdateProjectTypeStatusPayload {
  status: "ACTIVE" | "SUSPENDED";
}

export interface RequestDocumentUploadPayload {
  fileName: string;
  displayName: string;
  contentType?: string;
  sizeBytes?: number;
}

export const createProjectType = async (_societyId: string, payload: CreateProjectTypePayload) => {
  const { data } = await apiClient.post<FixedDepositProjectType>(
    "/fixed-deposits/project-types",
    payload,
  );
  return data;
};

export const listProjectTypes = async (_societyId: string, includeDeleted = false) => {
  const { data } = await apiClient.get<{ projectTypes: FixedDepositProjectType[] }>(
    "/fixed-deposits/project-types",
    {
      params: { includeDeleted: includeDeleted ? "true" : "false" },
    },
  );
  return data.projectTypes;
};

export const createFdAccount = async (_societyId: string, payload: CreateFdAccountPayload) => {
  const { data } = await apiClient.post<FixedDepositAccount>(
    "/fixed-deposits",
    payload,
  );
  return data;
};

export const updateFdAccount = async (
  _societyId: string,
  fdId: string,
  payload: UpdateFdAccountPayload,
) => {
  const { data } = await apiClient.patch<FixedDepositDetail>(
    `/fixed-deposits/${fdId}`,
    payload,
  );
  return data;
};

export const listFdAccounts = async (
  _societyId: string,
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
  const { data } = await apiClient.get<{ fixedDeposits: FixedDepositAccount[] }>(
    "/fixed-deposits",
    {
      params: {
        sortBy: sorting?.sortBy,
        sortOrder: sorting?.sortOrder,
        search: search?.trim() || undefined,
        includeDeleted: includeDeleted ? "true" : "false",
      },
    },
  );
  return data.fixedDeposits;
};

export const getFdDetail = async (_societyId: string, fdId: string) => {
  const { data } = await apiClient.get<FixedDepositDetail>(
    `/fixed-deposits/${fdId}`,
  );
  return data;
};

export const addTransaction = async (
  _societyId: string,
  fdId: string,
  payload: AddTransactionPayload,
) => {
  const { data } = await apiClient.post<{
    transaction: FixedDepositTransaction;
    fdDetail: FixedDepositDetail;
  }>(`/fixed-deposits/${fdId}/transactions`, payload);
  return data;
};

export const createFdEarlyPayoutRequest = async (
  _societyId: string,
  fdId: string,
  payload: CreateFdEarlyPayoutRequestPayload,
) => {
  const { data } = await apiClient.post<FdEarlyPayoutRequest>(
    `/fixed-deposits/${fdId}/early-payout-requests`,
    payload,
  );
  return data;
};

export const listFdEarlyPayoutRequests = async (_societyId: string, fdId: string) => {
  const { data } = await apiClient.get<{ requests: FdEarlyPayoutRequest[] }>(
    `/fixed-deposits/${fdId}/early-payout-requests`,
  );
  return data.requests;
};

export const listPendingFdEarlyPayoutRequests = async (_societyId: string) => {
  const { data } = await apiClient.get<{
    requests: Array<
      FdEarlyPayoutRequest & {
        fixDeposit: { id: string; customer: { id: string; fullName: string; phone: string } };
        requestedByDisplayName: string;
        expiresAtDisplay: string;
      }
    >;
  }>("/fixed-deposits/early-payout-requests/pending");
  return data.requests;
};

export const approveFdEarlyPayoutRequest = async (
  _societyId: string,
  requestId: string,
  body?: { recalculatePrincipalAndMaturity?: boolean },
) => {
  const { data } = await apiClient.post<FdEarlyPayoutRequest>(
    `/fixed-deposits/early-payout-requests/${requestId}/approve`,
    body ?? {},
  );
  return data;
};

export const rejectFdEarlyPayoutRequest = async (
  _societyId: string,
  requestId: string,
  payload?: { rejectionReason?: string },
) => {
  const { data } = await apiClient.post<FdEarlyPayoutRequest>(
    `/fixed-deposits/early-payout-requests/${requestId}/reject`,
    payload ?? {},
  );
  return data;
};

export const updateFdStatus = async (
  _societyId: string,
  fdId: string,
  payload: UpdateFdStatusPayload,
) => {
  const { data } = await apiClient.patch<FixedDepositAccount>(
    `/fixed-deposits/${fdId}/status`,
    payload,
  );
  return data;
};

export const updateProjectTypeStatus = async (
  _societyId: string,
  projectTypeId: string,
  payload: UpdateProjectTypeStatusPayload,
) => {
  const { data } = await apiClient.patch<FixedDepositProjectType>(
    `/fixed-deposits/project-types/${projectTypeId}/status`,
    payload,
  );
  return data;
};

export const deleteProjectType = async (_societyId: string, projectTypeId: string) => {
  const { data } = await apiClient.delete<{ success: boolean }>(
    `/fixed-deposits/project-types/${projectTypeId}`,
  );
  return data;
};

export const deleteFdAccount = async (_societyId: string, fdId: string) => {
  const { data } = await apiClient.delete<{ success: boolean }>(
    `/fixed-deposits/${fdId}`,
  );
  return data;
};

export const listFdReferrerMembers = async (_societyId: string) => {
  const { data } = await apiClient.get<{ members: ReferrerMember[] }>(
    "/fixed-deposits/referrers",
  );
  return data.members;
};

export const requestFdDocumentUploadUrl = async (
  _societyId: string,
  fdId: string,
  payload: RequestDocumentUploadPayload,
) => {
  const { data } = await apiClient.post<{
    document: FixedDepositDocument;
    uploadUrl: string;
    fileUrl: string;
  }>(`/fixed-deposits/${fdId}/documents/upload-url`, payload);
  return data;
};

export const completeFdDocumentUpload = async (
  _societyId: string,
  fdId: string,
  documentId: string,
) => {
  const { data } = await apiClient.post<FixedDepositDocument>(
    `/fixed-deposits/${fdId}/documents/${documentId}/complete`,
    {},
  );
  return data;
};

/** Matches server rules in fixedDepositService. */
export const computeFdMaturityAmountPreview = (
  depositAmount: number,
  projectType:
    | Pick<
        FixedDepositProjectType,
        | "maturityCalculationMethod"
        | "maturityAmountPerHundred"
        | "maturityMultiple"
        | "duration"
      >
    | null
    | undefined,
): number | null => {
  if (!projectType || !depositAmount || depositAmount <= 0) return null;
  const method = projectType.maturityCalculationMethod ?? "PER_RS_100";
  if (method === "MULTIPLE_OF_PRINCIPAL") {
    return depositAmount * Number(projectType.maturityMultiple);
  }
  if (method === "COMPOUNDING_INTEREST") {
    const rate = Number(projectType.maturityAmountPerHundred) / 100;
    const years = projectType.duration / 12;
    return Number((depositAmount * Math.pow(1 + rate, years)).toFixed(2));
  }
  if (method === "INTEREST_MATURITY" || method === "SIMPLE_INTEREST") {
    const rate = Number(projectType.maturityAmountPerHundred);
    const years = projectType.duration / 12;
    return depositAmount + (depositAmount * rate * years) / 100;
  }
  return (depositAmount / 100) * Number(projectType.maturityAmountPerHundred);
};
