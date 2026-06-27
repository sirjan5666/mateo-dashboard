import { api } from './client';

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'cancelled';

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface InvoiceListItem {
  id: string;
  number: string;
  patientId: string;
  patientName: string;
  date: string;
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
  paidAt: string | null;
}

export interface InvoiceFull extends InvoiceListItem {
  items: InvoiceItem[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSummary {
  outstanding: number;
  collectedToday: number;
  collectedMonth: number;
  byDay: { date: string; label: string; amount: number }[];
  totalInvoices: number;
  unpaidCount: number;
}

export interface CreateInvoiceInput {
  patientId: string;
  items: InvoiceItem[];
  date?: string;
  notes?: string;
}

export function listInvoices(status?: InvoiceStatus) {
  return api<{ invoices: InvoiceListItem[] }>(`/doctor/billing/invoices${status ? `?status=${status}` : ''}`);
}

export function getInvoice(id: string) {
  return api<{ invoice: InvoiceFull }>(`/doctor/billing/invoices/${id}`);
}

export function createInvoice(body: CreateInvoiceInput) {
  return api<{ invoice: InvoiceFull }>('/doctor/billing/invoices', { method: 'POST', body: JSON.stringify(body) });
}

export function updateInvoice(id: string, status: 'paid' | 'unpaid' | 'cancelled') {
  return api<{ invoice: InvoiceFull }>(`/doctor/billing/invoices/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function getBillingSummary() {
  return api<BillingSummary>('/doctor/billing/summary');
}
