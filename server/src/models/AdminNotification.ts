import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// In-app admin notifications. A row is created whenever something needs an
// admin's attention (today: a new order). This is the always-works channel —
// email (lib/mailer.ts) is best-effort on top. The Admin → Orders UI reads the
// unread count + list from here.
export type AdminNotificationType = 'order_placed';

export interface IAdminNotification {
  type: AdminNotificationType;
  orderId?: Types.ObjectId;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

const adminNotificationSchema = new Schema<IAdminNotification>(
  {
    type: { type: String, enum: ['order_placed'], required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AdminNotification = model<IAdminNotification>('AdminNotification', adminNotificationSchema);
