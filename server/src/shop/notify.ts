// New-order admin notification. Always records an in-app AdminNotification (the
// channel that needs no configuration), then best-effort emails the admin(s).
// Recipients: ADMIN_NOTIFICATION_EMAIL if set, otherwise every admin user.
// Designed to never throw — callers fire-and-forget so it can't break checkout.
import type { HydratedDocument } from 'mongoose';
import { User } from '../models/User.js';
import { AdminNotification } from '../models/AdminNotification.js';
import { sendMail } from '../lib/mailer.js';
import { env } from '../config/env.js';
import type { IOrder } from '../models/Order.js';

export async function notifyAdminsOfNewOrder(order: HydratedDocument<IOrder>): Promise<void> {
  const itemsLine = order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ');
  const title = `New order ${order.orderNumber}`;
  const message = `${order.shippingAddress.fullName} placed order ${order.orderNumber} for ₹${order.totalInr} (${itemsLine}).`;

  try {
    await AdminNotification.create({ type: 'order_placed', orderId: order._id, title, message });
  } catch (err) {
    console.error('[notify] could not record admin notification:', err);
  }

  let recipients: string[] = [];
  if (env.ADMIN_NOTIFICATION_EMAIL) {
    recipients = [env.ADMIN_NOTIFICATION_EMAIL];
  } else {
    try {
      const admins = await User.find({ role: 'admin' }).select('email').lean();
      recipients = admins.map((a) => a.email).filter(Boolean);
    } catch (err) {
      console.error('[notify] could not load admin emails:', err);
    }
  }
  if (recipients.length === 0) return;

  const a = order.shippingAddress;
  const text = [
    title,
    '',
    message,
    '',
    'Ship to:',
    `${a.fullName}, ${a.phone}`,
    `${a.line1}${a.line2 ? ', ' + a.line2 : ''}`,
    `${a.city}, ${a.state} ${a.pincode}, ${a.country}`,
    '',
    `Total: ₹${order.totalInr} — paid via ${order.payment.method}`,
  ].join('\n');

  await sendMail({ to: recipients, subject: title, text });
}
