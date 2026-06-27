import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { LogIn, Pencil, Plus, Trash2, X } from 'lucide-react';
import { createParent, deleteUser, listParents, updateParent } from '../../api/admin';
import type { AdminParent, CreatedAccount } from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/context';
import { formatDateIST } from '../../lib/age';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { inputCls } from '../../components/ui/field';
import { CredentialsPanel } from '../../components/admin/CredentialsPanel';

export default function AdminParents() {
  const { impersonate } = useAuth();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [parents, setParents] = useState<AdminParent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loginAs(userId: string) {
    setBusyId(userId);
    try {
      await impersonate(userId);
      navigate('/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not switch user');
      setBusyId(null);
    }
  }

  async function remove(userId: string) {
    setBusyId(userId);
    setError(null);
    try {
      await deleteUser(userId);
      setParents((prev) => (prev ?? []).filter((p) => p.id !== userId));
      setConfirmDeleteId(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete user');
    } finally {
      setBusyId(null);
    }
  }
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedAccount | null>(null);

  function startCreate() {
    setEditingId(null);
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setReferralCode('');
    setFormError(null);
    setCreated(null);
    setShowForm(true);
  }

  function startEdit(p: AdminParent) {
    setEditingId(p.id);
    setName(p.name);
    setEmail(p.email);
    setPhone(p.phone ?? '');
    setPassword('');
    setFormError(null);
    setCreated(null);
    setShowForm(true);
  }

  async function load() {
    try {
      const d = await listParents();
      setParents(d.parents);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
    }
  }

  useEffect(() => {
    let cancelled = false;
    listParents()
      .then((d) => {
        if (!cancelled) setParents(d.parents);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      if (editingId) {
        await updateParent(editingId, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password: password || undefined,
        });
        setEditingId(null);
      } else {
        const account = await createParent({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password: password || undefined,
          referralCode: referralCode.trim() || undefined,
        });
        setCreated(account);
      }
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setReferralCode('');
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="text-2xl font-extrabold text-stone-900">Parents</h1>
        </div>
        <Button onClick={() => { if (showForm) { setShowForm(false); setEditingId(null); } else startCreate(); }} className="gap-1.5">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Close' : 'Add parent'}
        </Button>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {created && (
        <div className="mt-5">
          <CredentialsPanel account={created} onDone={() => setCreated(null)} />
        </div>
      )}

      {showForm && (
        <Card className="mt-5 p-5">
          <h2 className="font-bold text-stone-800">{editingId ? 'Edit parent' : 'New parent account'}</h2>
          <form onSubmit={handleSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pname" className="block text-sm font-medium text-stone-700">Name</label>
              <input id="pname" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="pphone" className="block text-sm font-medium text-stone-700">Phone number</label>
              <input id="pphone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" className={inputCls} />
            </div>
            <div>
              <label htmlFor="pemail" className="block text-sm font-medium text-stone-700">Email</label>
              <input id="pemail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="ppassword" className="block text-sm font-medium text-stone-700">Password</label>
              <input id="ppassword" type="text" required={!editingId} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              <p className="mt-1 text-xs text-stone-500">{editingId ? 'Leave blank to keep the current password.' : 'At least 8 characters — share with the parent.'}</p>
            </div>
            {!editingId && (
              <div className="sm:col-span-2">
                <label htmlFor="preferral" className="block text-sm font-medium text-stone-700">Referral code <span className="font-normal text-stone-400">(optional)</span></label>
                <input id="preferral" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="If another parent referred them" className={inputCls} />
              </div>
            )}
            {formError && <p className="text-sm text-rose-600 sm:col-span-2">{formError}</p>}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create account'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="mt-5 overflow-x-auto p-0">
        {parents === null ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : parents.length === 0 ? (
          <p className="p-8 text-center text-sm text-stone-500">No parents yet. Add the first one.</p>
        ) : (
          <table className="w-full min-w-[560px] text-left text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Phone</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Babies</th>
                <th className="px-5 py-3 font-semibold">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {parents.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50">
                  <td className="px-5 py-3 font-medium text-stone-800">{p.name}</td>
                  <td className="px-5 py-3 text-stone-600">{p.phone ?? '—'}</td>
                  <td className="px-5 py-3 text-stone-600">
                    <span className="block max-w-[460px] truncate" title={p.email}>{p.email}</span>
                  </td>
                  <td className="px-5 py-3 text-stone-600">{p.babies}</td>
                  <td className="px-5 py-3 text-stone-500">{formatDateIST(p.createdAt)}</td>
                  <td className="px-5 py-3">
                    {confirmDeleteId === p.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-rose-600">Delete &amp; all data?</span>
                        <button type="button" onClick={() => void remove(p.id)} disabled={busyId === p.id} className="text-xs font-bold text-rose-700 hover:text-rose-800 disabled:opacity-50">
                          Yes
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-xs font-medium text-stone-500 hover:text-stone-700">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void loginAs(p.id)}
                          disabled={busyId === p.id}
                          aria-label={`Log in as ${p.name}`}
                          title="Log in as this parent"
                          className="grid h-8 w-8 place-items-center rounded-lg text-indigo-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                        >
                          <LogIn className="h-[18px] w-[18px]" />
                        </button>
                        <button type="button" onClick={() => startEdit(p)} aria-label={`Edit ${p.name}`} title="Edit details" className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
                          <Pencil className="h-[18px] w-[18px]" />
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(p.id)} aria-label={`Delete ${p.name}`} title="Delete account" className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-[18px] w-[18px]" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
