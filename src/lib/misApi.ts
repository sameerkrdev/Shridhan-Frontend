import { apiClient } from "@/lib/apiClient";

export type PaymentMethod = "UPI" | "CASH" | "CHEQUE";
export type ServiceStatus = "PENDING_DEPOSIT" | "ACTIVE" | "COMPLETED" | "CLOSED";
export type MisTransactionType = "DEPOSIT" | "INTEREST_PAYOUT" | "PRINCIPAL_RETURN";
export type MisCalculationMethod = "MONTHLY_PAYOUT_PER_HUNDRED" | "ANNUAL_INTEREST_RATE";

export interface MisProjectType {
  id: string;
  name: string;
  duration: number;
  minimumAmount: string;
  calculationMethod: MisCalculationMethod;
  monthlyPayoutAmountPerHundred: string | null;
  annualInterestRate: string | null;
  isArchived?: boolean;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MisCustomer {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  aadhaar?: string | null;
  pan?: string | null;
}

export interface MisNominee {
  id: string;
  name: string;
  phone: string;
  relation?: string | null;
  address?: string | null;
  aadhaar?: string | null;
  pan?: string | null;
}

export interface MisTransaction {
  id: string;
  type: MisTransactionType;
  isExpected: boolean;
  month?: number | null;
  amount: string;
  paymentMethod?: PaymentMethod | null;
  transactionId?: string | null;
  upiId?: string | null;
  chequeNumber?: string | null;
  bankName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MisDocument {
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

export interface MisAccount {
  id: string;
  depositAmount: string;
  monthlyInterest: string;
  startDate: string;
  maturityDate: string;
  status: ServiceStatus;
  isDeleted?: boolean;
  customer: MisCustomer;
  projectType: MisProjectType;
  transactions?: MisTransaction[];
  uploadTargets?: Array<{
    documentId: string;
    displayName: string;
    fileName: string;
    uploadUrl: string;
    fileUrl: string;
  }>;
}

export interface MisDetail extends MisAccount {
  customer: MisCustomer & { nominees: MisNominee[] };
  transactions: MisTransaction[];
  documents?: MisDocument[];
  summary: {
    depositPaid: string;
    remainingDeposit: string;
    interestPaid: string;
    pendingMonths: number[];
  };
}

export interface PaginatedMisAccounts {
  items: MisAccount[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MisReferrerMember {
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

const societyHeader = (societyId: string) => ({
  headers: { "x-society-id": societyId },
});

export const createMisProjectType = async (
  societyId: string,
  payload: {
    name: string;
    duration: number;
    minimumAmount: number;
    calculationMethod: MisCalculationMethod;
    monthlyPayoutAmountPerHundred?: number;
    annualInterestRate?: number;
    rules?: string;
  },
) => {
  const { data } = await apiClient.post<MisProjectType>(
    "/mis/project-types",
    payload,
    societyHeader(societyId),
  );
  return data;
};

export const listMisProjectTypes = async (
  societyId: string,
  options?: { includeDeleted?: boolean; includeArchived?: boolean },
) => {
  const { data } = await apiClient.get<{ projectTypes: MisProjectType[] }>("/mis/project-types", {
    ...societyHeader(societyId),
    params: {
      includeDeleted: options?.includeDeleted ? "true" : "false",
      includeArchived: options?.includeArchived ? "true" : "false",
    },
  });
  return data.projectTypes;
};

export const createMisAccount = async (
  societyId: string,
  payload: {
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
    mis: {
      projectTypeId: string;
      depositAmount: number;
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
    documents?: Array<{
      fileName: string;
      displayName: string;
      contentType?: string;
      sizeBytes?: number;
    }>;
  },
) => {
  const { data } = await apiClient.post<MisAccount>("/mis", payload, societyHeader(societyId));
  return data;
};

export const listMisReferrerMembers = async (societyId: string) => {
  const { data } = await apiClient.get<{ members: MisReferrerMember[] }>(
    "/mis/referrers",
    societyHeader(societyId),
  );
  return data.members;
};

export const listMisAccounts = async (
  societyId: string,
  params: {
    page: number;
    pageSize: number;
    sortBy?:
      | "id"
      | "customer_name"
      | "phone"
      | "deposit_amount"
      | "monthly_interest"
      | "maturity_date"
      | "status";
    sortOrder?: "asc" | "desc";
    search?: string;
    includeDeleted?: boolean;
  },
) => {
  const { data } = await apiClient.get<PaginatedMisAccounts>("/mis", {
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

export const getMisDetail = async (societyId: string, misId: string) => {
  const { data } = await apiClient.get<MisDetail>(`/mis/${misId}`, societyHeader(societyId));
  return data;
};

export const addMisDeposit = async (
  societyId: string,
  misId: string,
  payload: {
    amount: number;
    paymentMethod?: PaymentMethod;
    transactionId?: string;
    upiId?: string;
    bankName?: string;
    chequeNumber?: string;
  },
) => {
  const { data } = await apiClient.post<MisTransaction>(
    `/mis/${misId}/deposit`,
    payload,
    societyHeader(societyId),
  );
  return data;
};

export const payMisInterest = async (
  societyId: string,
  misId: string,
  payload: {
    month?: number;
    months?: number[];
    amount: number;
    paymentMethod?: PaymentMethod;
    transactionId?: string;
    upiId?: string;
    bankName?: string;
    chequeNumber?: string;
  },
) => {
  const { data } = await apiClient.post<{ success: boolean }>(
    `/mis/${misId}/pay-interest`,
    payload,
    societyHeader(societyId),
  );
  return data;
};

export const returnMisPrincipal = async (
  societyId: string,
  misId: string,
  payload?: {
    paymentMethod?: PaymentMethod;
    transactionId?: string;
    upiId?: string;
    bankName?: string;
    chequeNumber?: string;
  },
) => {
  const { data } = await apiClient.post<MisTransaction>(
    `/mis/${misId}/return-principal`,
    payload ?? {},
    societyHeader(societyId),
  );
  return data;
};

export const deleteMisProjectType = async (societyId: string, projectTypeId: string) => {
  const { data } = await apiClient.delete<{ success: boolean }>(
    `/mis/project-types/${projectTypeId}`,
    societyHeader(societyId),
  );
  return data;
};

export const deleteMisAccount = async (societyId: string, misId: string) => {
  const { data } = await apiClient.delete<{ success: boolean }>(
    `/mis/${misId}`,
    societyHeader(societyId),
  );
  return data;
};

export const requestMisDocumentUploadUrl = async (
  societyId: string,
  misId: string,
  payload: {
    fileName: string;
    displayName: string;
    contentType?: string;
    sizeBytes?: number;
  },
) => {
  const { data } = await apiClient.post<{
    document: MisDocument;
    uploadUrl: string;
    fileUrl: string;
  }>(`/mis/${misId}/documents/upload-url`, payload, societyHeader(societyId));
  return data;
};

export const completeMisDocumentUpload = async (
  societyId: string,
  misId: string,
  documentId: string,
) => {
  const { data } = await apiClient.post<MisDocument>(
    `/mis/${misId}/documents/${documentId}/complete`,
    {},
    societyHeader(societyId),
  );
  return data;
};
