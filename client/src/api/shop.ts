import { api } from './client';

// Mirrors the server's public shapes (routes/shop.ts + data/shop-catalog.ts).
export type Brand = 'mateo' | 'neucomed';

export interface ShopProduct {
  id: string;
  brand: Brand;
  name: string;
  tagline: string;
  priceInr: number;
  image: string;
  description: string;
  highlights: string[];
  ingredients?: string;
  // Infant-formula-only:
  type?: string;
  ageRange?: string;
  sizes?: string[];
  directions?: string;
  storage?: string;
  warning?: string;
  medicalSupervision?: boolean;
}

export interface CartLine {
  productId: string;
  name: string;
  brand: Brand;
  priceInr: number;
  image: string;
  size?: string;
  quantity: number;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  email?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  name: string;
  brand: Brand;
  priceInr: number;
  quantity: number;
  size?: string;
  image: string;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface OrderTracking {
  carrier?: string;
  trackingNumber?: string;
  url?: string;
}

export interface OrderPayment {
  method: 'razorpay' | 'mock';
  status: 'pending' | 'paid' | 'failed';
  amountInr: number;
  paidAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  subtotalInr: number;
  shippingInr: number;
  totalInr: number;
  shippingAddress: ShippingAddress;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
  tracking: OrderTracking;
  hasFormula: boolean;
  payment: OrderPayment;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrder extends Order {
  customer: { name: string; email: string };
}

export interface AdminNotification {
  id: string;
  type: string;
  orderId?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface CreateOrderInput {
  items: { productId: string; quantity: number; size?: string }[];
  shippingAddress: ShippingAddress;
}

export interface RazorpayInit {
  keyId: string;
  orderId: string;
  amount: number; // paise
  currency: string;
}

export interface CreateOrderResult {
  order: Order;
  razorpay?: RazorpayInit;
  mock?: boolean;
}

// ── Catalog ──────────────────────────────────────────────────────────────────
export function listShopProducts(brand?: Brand) {
  return api<{ products: ShopProduct[] }>(`/shop/products${brand ? `?brand=${brand}` : ''}`);
}

export function getShopProduct(id: string) {
  return api<{ product: ShopProduct }>(`/shop/products/${encodeURIComponent(id)}`);
}

// ── Orders (customer) ────────────────────────────────────────────────────────
export function createOrder(input: CreateOrderInput) {
  return api<CreateOrderResult>('/shop/orders', { method: 'POST', body: JSON.stringify(input) });
}

export function verifyPayment(orderId: string, razorpayPaymentId: string, razorpaySignature: string) {
  return api<{ order: Order }>(`/shop/orders/${orderId}/verify`, {
    method: 'POST',
    body: JSON.stringify({ razorpayPaymentId, razorpaySignature }),
  });
}

export function listMyOrders() {
  return api<{ orders: Order[] }>('/shop/orders');
}

export function getMyOrder(id: string) {
  return api<{ order: Order }>(`/shop/orders/${id}`);
}

// ── Admin ────────────────────────────────────────────────────────────────────
export function adminListOrders(status?: string) {
  return api<{ orders: AdminOrder[] }>(`/shop/admin/orders${status && status !== 'all' ? `?status=${status}` : ''}`);
}

export function adminGetOrder(id: string) {
  return api<{ order: AdminOrder }>(`/shop/admin/orders/${id}`);
}

export interface AdminOrderUpdate {
  status?: OrderStatus;
  note?: string;
  tracking?: OrderTracking;
}

export function adminUpdateOrder(id: string, patch: AdminOrderUpdate) {
  return api<{ order: Order }>(`/shop/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function adminListNotifications() {
  return api<{ unread: number; notifications: AdminNotification[] }>('/shop/admin/notifications');
}

export function adminMarkNotificationsRead(ids?: string[]) {
  return api<{ ok: true; unread: number }>('/shop/admin/notifications/read', {
    method: 'POST',
    body: JSON.stringify(ids ? { ids } : {}),
  });
}
