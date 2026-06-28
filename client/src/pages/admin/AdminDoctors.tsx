import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { LogIn, Pencil, Plus, Trash2, X } from 'lucide-react';
import { createDoctor, deleteUser, listAdminDoctors, updateDoctor } from '../../api/admin';
import type { AdminDoctor, CreatedAccount } from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/context';
import { formatDateIST } from '../../lib/age';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { inputCls } from '../../components/ui/field';
import { cn } from '../../lib/cn';
import { CredentialsPanel } from '../../components/admin/CredentialsPanel';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOT_OPTIONS = [15, 20, 30, 45, 60];

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  rejected: 'bg-rose-50 text-rose-700',
};

export default function AdminDoctors() {
  const { impersonate } = useAuth();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<AdminDoctor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loginAs(userId: string) {
    setBusyId(userId);
    try {
      await impersonate(userId);
      navigate('/doctor');
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
      setDoctors((prev) => (prev ?? []).filter((d) => d.userId !== userId));
      setConfirmDeleteId(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete user');
    } finally {
      setBusyId(null);
    }
  }
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [languages, setLanguages] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('approved');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotMinutes, setSlotMinutes] = useState(30);

  function resetFields() {
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setSpecialization('');
    setConsultationFee('');
    setQualifications('');
    setExperienceYears('');
    setLanguages('');
    setCity('');
    setStatus('approved');
    setDays([1, 2, 3, 4, 5]);
    setStartTime('10:00');
    setEndTime('17:00');
    setSlotMinutes(30);
  }

  function startCreate() {
    setEditingId(null);
    resetFields();
    setFormError(null);
    setCreated(null);
    setShowForm(true);
  }

  function startEdit(d: AdminDoctor) {
    setEditingId(d.id);
    setName(d.name);
    setEmail(d.email ?? '');
    setPhone(d.phone ?? '');
    setPassword('');
    setSpecialization(d.specialization);
    setConsultationFee(String(d.consultationFee));
    setQualifications(d.qualifications);
    setExperienceYears(d.experienceYears ? String(d.experienceYears) : '');
    setLanguages(d.languages.join(', '));
    setCity(d.city ?? '');
    setStatus(d.status as 'pending' | 'approved' | 'rejected');
    setDays(d.availability.days);
    setStartTime(d.availability.startTime);
    setEndTime(d.availability.endTime);
    setSlotMinutes(d.availability.slotMinutes);
    setFormError(null);
    setCreated(null);
    setShowForm(true);
  }

  async function load() {
    try {
      const d = await listAdminDoctors();
      setDoctors(d.doctors);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
    }
  }

  useEffect(() => {
    let cancelled = false;
    listAdminDoctors()
      .then((d) => {
        if (!cancelled) setDoctors(d.doctors);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fee = parseInt(consultationFee, 10);
    if (!specialization.trim()) {
      setFormError('Specialization is required');
      return;
    }
    if (Number.isNaN(fee) || fee < 0) {
      setFormError('Enter a valid consultation fee');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        specialization: specialization.trim(),
        qualifications: qualifications.trim(),
        experienceYears: experienceYears ? parseInt(experienceYears, 10) : 0,
        consultationFee: fee,
        languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
        city: city.trim() || undefined,
        availability: { days, startTime, endTime, slotMinutes },
      };
      if (editingId) {
        await updateDoctor(editingId, {
          ...payload,
          password: password || undefined,
          status,
        });
        setEditingId(null);
      } else {
        const account = await createDoctor({ ...payload, password: password || undefined });
        setCreated(account);
      }
      setShowForm(false);
      resetFields();
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
          <h1 className="text-2xl font-extrabold text-stone-900">Doctors</h1>
        </div>
        <Button onClick={() => { if (showForm) { setShowForm(false); setEditingId(null); } else startCreate(); }} className="gap-1.5">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Close' : 'Add doctor'}
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
          <h2 className="font-bold text-stone-800">{editingId ? 'Edit doctor' : 'New doctor account'}</h2>
          <form onSubmit={handleSubmit} className="mt-3 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="dname" className="block text-sm font-medium text-stone-700">Name</label>
                <input id="dname" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="demail" className="block text-sm font-medium text-stone-700">Email</label>
                <input id="demail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="dphone" className="block text-sm font-medium text-stone-700">Phone number</label>
                <input id="dphone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" className={inputCls} />
              </div>
              <div>
                <label htmlFor="dpassword" className="block text-sm font-medium text-stone-700">Password</label>
                <input id="dpassword" type="text" required={!editingId} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                <p className="mt-1 text-xs text-stone-500">{editingId ? 'Leave blank to keep the current password.' : 'At least 8 characters — share with the doctor.'}</p>
              </div>
              <div>
                <label htmlFor="dspec" className="block text-sm font-medium text-stone-700">Specialization *</label>
                <input id="dspec" value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Pediatrician" className={inputCls} />
              </div>
              <div>
                <label htmlFor="dfee" className="block text-sm font-medium text-stone-700">Consultation fee (₹) *</label>
                <input id="dfee" type="number" min="0" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="dquals" className="block text-sm font-medium text-stone-700">Qualifications</label>
                <input id="dquals" value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="MBBS, MD" className={inputCls} />
              </div>
              <div>
                <label htmlFor="dexp" className="block text-sm font-medium text-stone-700">Experience (years)</label>
                <input id="dexp" type="number" min="0" max="80" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="dlangs" className="block text-sm font-medium text-stone-700">Languages</label>
                <input id="dlangs" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Hindi" className={inputCls} />
              </div>
              <div>
                <label htmlFor="dcity" className="block text-sm font-medium text-stone-700">City</label>
                <input id="dcity" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
              </div>
              {editingId && (
                <div>
                  <label htmlFor="dstatus" className="block text-sm font-medium text-stone-700">Status</label>
                  <select id="dstatus" value={status} onChange={(e) => setStatus(e.target.value as 'pending' | 'approved' | 'rejected')} className={inputCls}>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-stone-200 p-4">
              <h3 className="text-sm font-semibold text-stone-800">Availability</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {DAYS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(i)}
                    aria-pressed={days.includes(i)}
                    className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', days.includes(i) ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200')}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="dstart" className="block text-xs text-stone-500">From</label>
                  <input id="dstart" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="dend" className="block text-xs text-stone-500">To</label>
                  <input id="dend" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="dslot" className="block text-xs text-stone-500">Slot length</label>
                  <select id="dslot" value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className={inputCls}>
                    {SLOT_OPTIONS.map((m) => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </div>
              </div>
            </div>

            {formError && <p className="text-sm text-rose-600">{formError}</p>}
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create doctor account'}</Button>
          </form>
        </Card>
      )}

      <Card className="mt-5 overflow-x-auto p-0">
        {doctors === null ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : doctors.length === 0 ? (
          <p className="p-8 text-center text-sm text-stone-500">No doctors yet. Add the first one.</p>
        ) : (
          <table className="w-full min-w-[920px] text-left text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Phone</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Specialization</th>
                <th className="px-5 py-3 font-semibold">Fee</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Added</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {doctors.map((d) => (
                <tr key={d.id} className="hover:bg-stone-50">
                  <td className="px-5 py-3 font-medium text-stone-800">Dr. {d.name}</td>
                  <td className="px-5 py-3 text-stone-600">{d.phone ?? '—'}</td>
                  <td className="px-5 py-3 text-stone-600">
                    <span className="block max-w-[460px] truncate" title={d.email ?? ''}>{d.email}</span>
                  </td>
                  <td className="px-5 py-3 text-stone-600">{d.specialization}</td>
                  <td className="px-5 py-3 text-stone-600">₹{d.consultationFee}</td>
                  <td className="px-5 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold capitalize', STATUS_STYLES[d.status] ?? 'bg-stone-100 text-stone-500')}>{d.status}</span>
                  </td>
                  <td className="px-5 py-3 text-stone-500">{formatDateIST(d.createdAt)}</td>
                  <td className="px-5 py-3">
                    {confirmDeleteId === d.userId ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-rose-600">Delete &amp; all data?</span>
                        <button type="button" onClick={() => void remove(d.userId)} disabled={busyId === d.userId} className="text-xs font-bold text-rose-700 hover:text-rose-800 disabled:opacity-50">
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
                          onClick={() => void loginAs(d.userId)}
                          disabled={busyId === d.userId}
                          aria-label={`Log in as ${d.name}`}
                          title="Log in as this doctor"
                          className="grid h-8 w-8 place-items-center rounded-lg text-indigo-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                        >
                          <LogIn className="h-[18px] w-[18px]" />
                        </button>
                        <button type="button" onClick={() => startEdit(d)} aria-label={`Edit ${d.name}`} title="Edit details" className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
                          <Pencil className="h-[18px] w-[18px]" />
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(d.userId)} aria-label={`Delete ${d.name}`} title="Delete account" className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
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
