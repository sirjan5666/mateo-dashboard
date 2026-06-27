import { useEffect, useState } from 'react';
import { Bell, Package } from 'lucide-react';
import {
  adminListOrders,
  adminUpdateOrder,
  adminDeleteOrder,
  adminListNotifications,
  adminMarkNotificationsRead,
} from '../../api/shop';
import type { AdminOrder, Order, OrderStatus, OrderTracking } from '../../api/shop';
import { ApiError } from '../../api/client';
import { inr, ORDER_STATUS_META } from '../../shop/format';
import { formatDateIST } from '../../lib/age';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { inputCls } from '../../components/ui/field';
import { OrderStatusTimeline } from '../../components/shop/OrderStatusTimeline';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];
const EDITABLE_STATUSES: OrderStatus[] = ['confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

function AdminOrderModal({
  order,
  onClose,
  onSaved,
  onDeleted,
}: {
  order: AdminOrder | null;
  onClose: () => void;
  onSaved: (o: Order) => void;
  onDeleted: (id: string) => void;
}) {
  // Initialised from the order prop; the parent passes a `key` so a different
  // order remounts this with fresh state (no setState-in-effect needed).
  const [status, setStatus] = useState<OrderStatus>(order?.status ?? 'confirmed');
  const [tracking, setTracking] = useState<OrderTracking>(order?.tracking ?? {});
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!order) return null;

  async function save() {
    if (!order) return;
    setSaving(true);
    setErr(null);
    try {
      const d = await adminUpdateOrder(order.id, { status, tracking, note: note || undefined });
      onSaved(d.order);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save changes.');
      setSaving(false);
    }
  }

  async function remove() {
    if (!order) return;
    if (!window.confirm(`Delete order ${order.orderNumber}? This permanently removes it and cannot be undone. (Use “Cancelled” status instead if you want to keep the record.)`)) return;
    setDeleting(true);
    setErr(null);
    try {
      await adminDeleteOrder(order.id);
      onDeleted(order.id);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not delete the order.');
      setDeleting(false);
    }
  }

  return (
    <Modal open={!!order} onClose={onClose} title={`Order ${order.orderNumber}`} size="lg">
      <div className="space-y-5">
        <div className="text-sm text-stone-600">
          <p className="font-semibold text-stone-800">
            {order.customer.name} · {order.customer.email}
          </p>
          <p className="mt-1">
            {order.shippingAddress.fullName}, {order.shippingAddress.phone}
          </p>
          <p>
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city},{' '}
            {order.shippingAddress.state} {order.shippingAddress.pincode}
          </p>
        </div>

        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200">
          {order.items.map((it) => (
            <li key={it.productId + (it.size ?? '')} className="flex items-center justify-between gap-2 p-3 text-sm">
              <span className="text-stone-700">
                {it.quantity}× {it.name}
                {it.size ? ` (${it.size})` : ''}
              </span>
              <span className="font-medium">{inr(it.priceInr * it.quantity)}</span>
            </li>
          ))}
          <li className="flex items-center justify-between p-3 text-sm font-bold">
            <span>Total</span>
            <span>{inr(order.totalInr)}</span>
          </li>
        </ul>

        {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-sm font-medium text-stone-700">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className={inputCls}>
              {EDITABLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_META[s].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-stone-700">Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="e.g. Handed to courier" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-stone-700">Carrier</span>
            <input value={tracking.carrier ?? ''} onChange={(e) => setTracking((tk) => ({ ...tk, carrier: e.target.value }))} className={inputCls} placeholder="e.g. Delhivery" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-stone-700">Tracking number</span>
            <input value={tracking.trackingNumber ?? ''} onChange={(e) => setTracking((tk) => ({ ...tk, trackingNumber: e.target.value }))} className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-sm font-medium text-stone-700">Tracking URL</span>
            <input value={tracking.url ?? ''} onChange={(e) => setTracking((tk) => ({ ...tk, url: e.target.value }))} className={inputCls} placeholder="https://…" />
          </label>
        </div>

        <div className="rounded-2xl border border-stone-200 p-4">
          <OrderStatusTimeline order={order} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={deleting || saving}
            className="text-sm font-semibold text-rose-600 transition-colors hover:text-rose-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete order'}
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={saving || deleting}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [unread, setUnread] = useState(0);
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminListOrders(filter)
      .then((d) => !cancelled && setOrders(d.orders))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load orders.'));
    return () => {
      cancelled = true;
    };
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    adminListNotifications()
      .then((d) => !cancelled && setUnread(d.unread))
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function markRead() {
    try {
      const d = await adminMarkNotificationsRead();
      setUnread(d.unread);
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <header className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-100 text-violet-700">
          <Package className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-extrabold text-stone-900">Shop Orders</h1>
          <p className="text-sm text-stone-500">Manage orders, update status and tracking.</p>
        </div>
      </header>

      {unread > 0 && (
        <Card className="mb-4 flex items-center gap-3 border-violet-200 bg-violet-50 p-4">
          <Bell className="h-5 w-5 shrink-0 text-violet-700" />
          <p className="flex-1 text-sm text-violet-900">
            {unread} new order{unread > 1 ? 's' : ''} need attention.
          </p>
          <Button size="sm" variant="secondary" onClick={markRead}>
            Mark as read
          </Button>
        </Card>
      )}

      {error && <Card className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      <div className="mb-4 overflow-x-auto">
        <SegmentedControl
          value={filter}
          onChange={(v) => {
            setOrders(null);
            setFilter(v);
          }}
          options={STATUS_OPTIONS}
        />
      </div>

      {orders === null ? (
        <Skeleton className="h-64 w-full rounded-[26px]" />
      ) : orders.length === 0 ? (
        <Card className="p-8 text-center text-sm text-stone-500">No orders here yet.</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const meta = ORDER_STATUS_META[o.status];
                return (
                  <tr key={o.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-3 font-mono-ds font-semibold text-stone-900">{o.orderNumber}</td>
                    <td className="px-4 py-3">
                      <div className="text-stone-800">{o.customer.name}</div>
                      <div className="text-xs text-stone-400">{o.customer.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{formatDateIST(o.createdAt)}</td>
                    <td className="px-4 py-3 text-stone-600">
                      {o.items.reduce((n, i) => n + i.quantity, 0)}
                      {o.hasFormula && (
                        <Pill tone="amber" className="ml-1">
                          formula
                        </Pill>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-stone-900">{inr(o.totalInr)}</td>
                    <td className="px-4 py-3">
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setSelected(o)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <AdminOrderModal
        key={selected?.id ?? 'none'}
        order={selected}
        onClose={() => setSelected(null)}
        onSaved={(updated) => {
          setOrders((cur) => (cur ? cur.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)) : cur));
          setSelected(null);
        }}
        onDeleted={(id) => {
          setOrders((cur) => (cur ? cur.filter((o) => o.id !== id) : cur));
          setSelected(null);
        }}
      />
    </div>
  );
}
