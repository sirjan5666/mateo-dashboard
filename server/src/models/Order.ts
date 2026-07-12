import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import type { Brand } from '../data/shop-catalog.js';

// A shop order. Line items are SNAPSHOTS of the catalog at purchase time (name,
// price, brand, image) so the order stays accurate even if the catalog changes.
// Amounts are whole INR (matching the consultations convention). Every order is
// scoped to userId — a parent only ever sees their own orders.

export type OrderStatus = 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
export const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

export interface IOrderItem {
  productId: string; // catalog slug
  name: string;
  brand: Brand;
  priceInr: number;
  quantity: number;
  size?: string;
  image: string;
}

export interface IShippingAddress {
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

export interface IOrderPayment {
  method: 'razorpay' | 'mock';
  status: 'pending' | 'paid' | 'failed';
  amountInr: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paidAt?: Date;
}

export interface IOrderStatusEvent {
  status: OrderStatus;
  at: Date;
  note?: string;
}

export interface IOrderTracking {
  carrier?: string;
  trackingNumber?: string;
  url?: string;
}

// Mateo Sitare loyalty snapshot on the order — what was redeemed (points → ₹ off
// the eligible, non-formula base) and what was earned. Self-describing for
// receipts + reconciliation. `reservationId` links to the held PointsLedger row.
export interface IOrderSitare {
  pointsRedeemed: number;
  discountInr: number;
  eligibleSubtotalInr: number;
  reservationId?: string;
  earnedPoints: number;
}

export interface IOrder {
  userId: Types.ObjectId;
  orderNumber: string; // short human-friendly reference, e.g. MT-K3F9Q2
  items: IOrderItem[];
  subtotalInr: number;
  shippingInr: number;
  totalInr: number;
  shippingAddress: IShippingAddress;
  status: OrderStatus;
  statusHistory: IOrderStatusEvent[];
  tracking: IOrderTracking;
  payment: IOrderPayment;
  sitare?: IOrderSitare;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IOrderItem>(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    brand: { type: String, enum: ['mateo', 'neucomed'], required: true },
    priceInr: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    size: { type: String },
    image: { type: String, default: '' },
  },
  { _id: false },
);

const addressSchema = new Schema<IShippingAddress>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, default: 'India', trim: true },
  },
  { _id: false },
);

const paymentSchema = new Schema<IOrderPayment>(
  {
    method: { type: String, enum: ['razorpay', 'mock'], required: true },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    amountInr: { type: Number, required: true, min: 0 },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    paidAt: { type: Date },
  },
  { _id: false },
);

const statusEventSchema = new Schema<IOrderStatusEvent>(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true },
    note: { type: String, trim: true },
  },
  { _id: false },
);

const trackingSchema = new Schema<IOrderTracking>(
  {
    carrier: { type: String, trim: true },
    trackingNumber: { type: String, trim: true },
    url: { type: String, trim: true },
  },
  { _id: false },
);

const sitareSchema = new Schema<IOrderSitare>(
  {
    pointsRedeemed: { type: Number, required: true, min: 0, default: 0 },
    discountInr: { type: Number, required: true, min: 0, default: 0 },
    eligibleSubtotalInr: { type: Number, required: true, min: 0, default: 0 },
    reservationId: { type: String },
    earnedPoints: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderNumber: { type: String, required: true, unique: true },
    items: { type: [itemSchema], required: true },
    subtotalInr: { type: Number, required: true, min: 0 },
    shippingInr: { type: Number, required: true, min: 0, default: 0 },
    totalInr: { type: Number, required: true, min: 0 },
    shippingAddress: { type: addressSchema, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
    statusHistory: { type: [statusEventSchema], default: [] },
    tracking: { type: trackingSchema, default: {} },
    payment: { type: paymentSchema, required: true },
    sitare: { type: sitareSchema },
  },
  { timestamps: true },
);

export const Order = model<IOrder>('Order', orderSchema);
