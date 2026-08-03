import { api } from './client';
import type { AdminDealRow, AdminUserRow, CreateDealInput, DealCost, DealDetail, DealEvent, DealSummary, DocumentSummary, DomainConfig, LoginResponse, Message, Paginated, Payment, TimberPost, UpdateBankAccountInput, UpdateProfileInput, UserProfile } from '@sprintaiso/api-types';

// --- auth ---
export async function loginRequest(email: string, password: string) {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

export async function logoutRequest() {
  await api.post('/auth/logout');
}

// --- me ---
export async function fetchMe() {
  const { data } = await api.get<UserProfile>('/me');
  return data;
}

export async function updateProfile(input: UpdateProfileInput) {
  const { data } = await api.patch<UserProfile>('/me', input);
  return data;
}

export async function updateBankAccount(input: UpdateBankAccountInput) {
  const { data } = await api.put<{
    bankAccountMasked: string;
    bankAccountUpdatedAt: string;
  }>('/me/bank-account', input);
  return data;
}

// --- deals (kund) ---
export async function fetchDeals(page = 1, limit = 50) {
  const { data } = await api.get<Paginated<DealSummary>>('/deals', { params: { page, limit } });
  return data;
}

export async function fetchDeal(id: string) {
  const { data } = await api.get<DealDetail>(`/deals/${id}`);
  return data;
}

export async function fetchDealEvents(id: string) {
  const { data } = await api.get<{ data: DealEvent[]; }>(`/deals/${id}/events`);
  return data.data;
}

export async function fetchDealTimber(id: string) {
  const { data } = await api.get<{ data: TimberPost[]; }>(`/deals/${id}/timber`);
  return data.data;
}

export async function fetchDealCosts(id: string) {
  const { data } = await api.get<{ data: DealCost[]; }>(`/deals/${id}/costs`);
  return data.data;
}

export async function fetchDealDocuments(id: string) {
  const { data } = await api.get<{ data: DocumentSummary[]; }>(`/deals/${id}/documents`);
  return data.data;
}

export async function fetchDealMessages(id: string) {
  const { data } = await api.get<{ data: Message[]; }>(`/deals/${id}/messages`);
  return data.data;
}

export async function sendDealMessage(id: string, body: string) {
  const { data } = await api.post<Message>(`/deals/${id}/messages`, { body });
  return data;
}

// --- payments ---
export async function fetchPayments() {
  const { data } = await api.get<Paginated<Payment>>('/payments', { params: { limit: 100 } });
  return data;
}

// --- admin ---
export async function fetchAdminUsers() {
  const { data } = await api.get<Paginated<AdminUserRow>>('/admin/users', {
    params: { limit: 100 },
  });
  return data;
}

export async function fetchAdminDeals() {
  const { data } = await api.get<Paginated<AdminDealRow>>('/admin/deals', {
    params: { limit: 100 },
  });
  return data;
}

export async function createAdminDeal(input: CreateDealInput) {
  const { data } = await api.post<AdminDealRow>('/admin/deals', input);
  return data;
}

// --- config ---
export async function fetchDomainConfig() {
  const { data } = await api.get<DomainConfig>('/config');
  return data;
}
