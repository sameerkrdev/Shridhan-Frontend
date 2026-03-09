import { apiClient } from "@/lib/apiClient";

export type PaymentMethod = "UPI" | "CASH" | "CHEQUE";
export type TransactionType = "CREDIT" | "PAYOUT";
export type ServiceStatus = "ACTIVE" | "COMPLETED" | "CLOSED";

export interface FixedDepositProjectType {
  id: string;
  name: string;
  duration: number;
  minimumAmount: string;
  maturityMultiple: string;
  maturityAmountPerHundred: string;
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
  maturityAmountPerHundred: number;
  maturityMultiple: number;
}

export interface CreateFdAccountPayload {
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

export interface AddTransactionPayload {
  type: TransactionType;
  amount: number;
  paymentMethod?: PaymentMethod;
  transactionId?: string;
  upiId?: string;
  bankName?: string;
  chequeNumber?: string;
  month?: number;
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

const societyHeader = (societyId: string) => ({
  headers: { "x-society-id": societyId },
});

export const createProjectType = async (societyId: string, payload: CreateProjectTypePayload) => {
  const { data } = await apiClient.post<FixedDepositProjectType>(
    "/fixed-deposits/project-types",
    payload,
    societyHeader(societyId),
  );
  return data;
};

export const listProjectTypes = async (societyId: string, includeDeleted = false) => {
  const { data } = await apiClient.get<{ projectTypes: FixedDepositProjectType[] }>(
    "/fixed-deposits/project-types",
    {
      ...societyHeader(societyId),
      params: { includeDeleted: includeDeleted ? "true" : "false" },
    },
  );
  return data.projectTypes;
};

export const createFdAccount = async (societyId: string, payload: CreateFdAccountPayload) => {
  const { data } = await apiClient.post<FixedDepositAccount>(
    "/fixed-deposits",
    payload,
    societyHeader(societyId),
  );
  return data;
};

export const listFdAccounts = async (
  societyId: string,
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
      ...societyHeader(societyId),
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

export const getFdDetail = async (societyId: string, fdId: string) => {
  const { data } = await apiClient.get<FixedDepositDetail>(
    `/fixed-deposits/${fdId}`,
    societyHeader(societyId),
  );
  return data;
};

export const addTransaction = async (
  societyId: string,
  fdId: string,
  payload: AddTransactionPayload,
) => {
  const { data } = await apiClient.post<FixedDepositTransaction>(
    `/fixed-deposits/${fdId}/transactions`,
    payload,
    societyHeader(societyId),
  );
  return data;
};

export const updateFdStatus = async (societyId: string, fdId: string, payload: UpdateFdStatusPayload) => {
  const { data } = await apiClient.patch<FixedDepositAccount>(
    `/fixed-deposits/${fdId}/status`,
    payload,
    societyHeader(societyId),
  );
  return data;
};

export const updateProjectTypeStatus = async (
  societyId: string,
  projectTypeId: string,
  payload: UpdateProjectTypeStatusPayload,
) => {
  const { data } = await apiClient.patch<FixedDepositProjectType>(
    `/fixed-deposits/project-types/${projectTypeId}/status`,
    payload,
    societyHeader(societyId),
  );
  return data;
};

export const deleteProjectType = async (societyId: string, projectTypeId: string) => {
  const { data } = await apiClient.delete<{ success: boolean }>(
    `/fixed-deposits/project-types/${projectTypeId}`,
    societyHeader(societyId),
  );
  return data;
};

export const deleteFdAccount = async (societyId: string, fdId: string) => {
  const { data } = await apiClient.delete<{ success: boolean }>(`/fixed-deposits/${fdId}`, societyHeader(societyId));
  return data;
};

export const listFdReferrerMembers = async (societyId: string) => {
  const { data } = await apiClient.get<{ members: ReferrerMember[] }>(
    "/fixed-deposits/referrers",
    societyHeader(societyId),
  );
  return data.members;
};

export const requestFdDocumentUploadUrl = async (
  societyId: string,
  fdId: string,
  payload: RequestDocumentUploadPayload,
) => {
  const { data } = await apiClient.post<{
    document: FixedDepositDocument;
    uploadUrl: string;
    fileUrl: string;
  }>(`/fixed-deposits/${fdId}/documents/upload-url`, payload, societyHeader(societyId));
  return data;
};

export const completeFdDocumentUpload = async (societyId: string, fdId: string, documentId: string) => {
  const { data } = await apiClient.post<FixedDepositDocument>(
    `/fixed-deposits/${fdId}/documents/${documentId}/complete`,
    {},
    societyHeader(societyId),
  );
  return data;
};
