import type { DealEventType, DealStatus, DealType, DocumentType, MessageSenderRole, PaymentStatus, UserRole
            } from '../../prisma/generated/prisma/enums.js';
import type { Locale } from '../lib/i18n.js';

export type {
  DealEventType,
  DealStatus,
  DealType,
  DocumentType,
  MessageSenderRole,
  PaymentStatus,
  UserRole,
};

export interface AuthUser {
  id: string;
  locale: Locale;
  email: string;
  name: string;
  role: UserRole;
  customerId: string | null;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface CustomerProfile {
  id: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    createdAt: string;
  };
  address: {
    street: string | null;
    postal: string | null;
    city: string | null;
  };
  phone: string | null;
  bankAccountMasked: string | null;
  bankAccountUpdatedAt: string | null;
  createdAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  phone?: string;
  addressStreet?: string;
  addressPostal?: string;
  addressCity?: string;
}

export interface UpdateBankAccountInput {
  bankAccount: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface DealSummary {
  id: string;
  externalId: string;
  title: string;
  dealType: DealType;
  status: DealStatus;
  estimatedGrossSek: string | null;
  finalGrossSek: string | null;
  totalCostsSek: string;
  createdAt: string;
  property: { id: string; name: string } | null;
  _count?: { events: number; timberPosts: number };
}

export interface DealDetail extends DealSummary {
  customerId: string;
  propertyId: string | null;
  assignedAdminId: string | null;
  syncedAt: string | null;
  updatedAt: string;
  property: {
    id: string;
    name: string;
    cadastralId?: string;
    municipality?: string;
    areaHa?: string;
  } | null;
  _count: {
    events: number;
    timberPosts: number;
    costs: number;
    documents: number;
    messages: number;
  };
}

export interface DealEvent {
  id: string;
  dealId: string;
  eventType: DealEventType;
  label: string;
  plannedDate: string | null;
  actualDate: string | null;
  note: string | null;
  createdAt: string;
}

export interface TimberPost {
  id: string;
  dealId: string;
  assortment: string;
  volumeM3: string;
  pricePerM3Sek: string;
  grossSek: string;
  measurementSource: string | null;
  createdAt: string;
}

export interface DealCost {
  id: string;
  dealId: string;
  costType: string;
  amountSek: string;
  note: string | null;
  createdAt: string;
}

export interface DocumentSummary {
  id: string;
  docType: DocumentType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface Message {
  id: string;
  dealId: string;
  senderId: string;
  senderRole: MessageSenderRole;
  body: string;
  attachments: unknown[];
  readAt: string | null;
  createdAt: string;
  sender: { id: string; name: string; role: UserRole };
}

export interface Payment {
  id: string;
  dealId: string;
  customerId: string;
  amountSek: string;
  paymentDate: string;
  status: PaymentStatus;
  reference: string | null;
  bankAccountMasked: string;
  externalPaymentId: string | null;
  createdAt: string;
  deal?: { id: string; externalId: string; title: string };
}

export interface AdminCustomerRow {
  id: string;
  user: { id: string; name: string; email: string; isActive: boolean };
  phone: string | null;
  addressCity: string | null;
  createdAt: string;
  _count: { deals: number; properties: number };
}

export interface CreateDealInput {
  customerId: string;
  propertyId?: string;
  externalId: string;
  title: string;
  dealType: DealType;
  status?: DealStatus;
  estimatedGrossSek?: number;
  assignedAdminId?: string;
}

export interface ApiErrorBody {
  error: string;
  code: string;
  statusCode: number;
  details?: unknown;
}

export interface DomainConfig {
  dealTypes: DealType[];
  dealStatuses: DealStatus[];
  paymentStatuses: PaymentStatus[];
  userRoles: UserRole[];
}
