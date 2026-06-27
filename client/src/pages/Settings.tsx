import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Download, Languages, Phone, Plus, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import { useAuth } from '../auth/context';
import { useLang, useT } from '../i18n/context';
import { LANGS } from '../i18n/translations';
import { addContact, deleteAccount, deleteContact, exportData, listContacts, updateProfile } from '../api/account';
import type { EmergencyContact } from '../api/account';
import { ApiError } from '../api/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { inputCls } from '../components/ui/field';
import { cn } from '../lib/cn';

export default function Settings() {
  const { user, refresh } = useAuth();
  const t = useT();
  const { lang, setLang } = useLang();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [contacts, setContacts] = useState<EmergencyContact[] | null>(null);
  const [cName, setCName] = useState('');
  const [cRelation, setCRelation] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cSaving, setCSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listContacts()
      .then((d) => !cancelled && setContacts(d.contacts))
      .catch(() => !cancelled && setContacts([]));
    return () => {
      cancelled = true;
    };
  }, []);

  function fail(err: unknown) {
    setNotice(null);
    setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSavingName(true);
    try {
      await updateProfile(name.trim());
      await refresh();
      setNotice('Your name has been updated.');
    } catch (err) {
      fail(err);
    } finally {
      setSavingName(false);
    }
  }

  async function submitContact(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCSaving(true);
    try {
      await addContact({ name: cName.trim(), relation: cRelation.trim() || undefined, phone: cPhone.trim() });
      setCName('');
      setCRelation('');
      setCPhone('');
      setContacts((await listContacts()).contacts);
    } catch (err) {
      fail(err);
    } finally {
      setCSaving(false);
    }
  }

  async function removeContact(contactId: string) {
    setBusyId(contactId);
    try {
      await deleteContact(contactId);
      setContacts((await listContacts()).contacts);
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleExport() {
    setError(null);
    setExporting(true);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mateo-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
      setNotice('Your data has been downloaded.');
    } catch (err) {
      fail(err);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete your account and ALL of your babies’ records? This cannot be undone.')) return;
    if (!window.confirm('Are you absolutely sure? Everything will be permanently erased.')) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      window.location.href = '/login';
    } catch (err) {
      fail(err);
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <h1 className="mt-3 text-2xl font-extrabold text-stone-900">{t('nav.settings')}</h1>
      <p className="text-sm text-stone-500">Your profile, emergency contacts, and privacy</p>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}
      {notice && <Card className="mt-5 border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</Card>}

      {/* Profile */}
      <Card className="mt-5 p-5">
        <h2 className="font-bold text-stone-800">Your profile</h2>
        <form onSubmit={saveName} className="mt-3 space-y-3">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-stone-700">Name</label>
            <input id="name" type="text" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <span className="block text-sm font-medium text-stone-700">Email</span>
            <p className="mt-1 rounded-xl bg-stone-100 px-3 py-2.5 text-sm text-stone-500">{user?.email}</p>
          </div>
          <Button type="submit" size="sm" disabled={savingName || name.trim() === (user?.name ?? '')}>
            {savingName ? 'Saving…' : 'Save name'}
          </Button>
        </form>
      </Card>

      {/* Language */}
      <Card className="mt-4 p-5">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-stone-500" />
          <h2 className="font-bold text-stone-800">{t('lang.label')}</h2>
        </div>
        <p className="mt-1 text-sm text-stone-500">{t('lang.help')}</p>
        <div role="group" aria-label={t('lang.choose')} className="mt-3 inline-flex gap-0.5 rounded-xl bg-stone-100 p-0.5">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              aria-pressed={lang === l.code}
              onClick={() => setLang(l.code)}
              className={cn('rounded-lg px-4 py-2 text-sm font-medium transition-colors', lang === l.code ? 'bg-white text-stone-900 shadow-soft' : 'text-stone-500 hover:text-stone-700')}
            >
              {l.native}
            </button>
          ))}
        </div>
      </Card>

      {/* Emergency contacts */}
      <Card className="mt-4 p-5">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-stone-500" />
          <h2 className="font-bold text-stone-800">Emergency contacts</h2>
        </div>
        <p className="mt-1 text-sm text-stone-500">Pediatrician, nearest hospital, family — one tap to call when it matters.</p>

        <div className="mt-3">
          {contacts === null ? (
            <Skeleton className="h-12 w-full" />
          ) : contacts.length === 0 ? (
            <p className="text-sm text-stone-500">No contacts yet.</p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl border border-stone-100 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-800">
                      {c.name}
                      {c.relation && <span className="ml-1 text-xs font-normal text-stone-500">· {c.relation}</span>}
                    </p>
                    <p className="text-xs text-stone-500">{c.phone}</p>
                  </div>
                  <a href={`tel:${c.phone}`} className="grid h-8 w-8 place-items-center rounded-lg text-emerald-700 transition-colors hover:bg-emerald-50" aria-label={`Call ${c.name}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                  <button onClick={() => void removeContact(c.id)} disabled={busyId === c.id} aria-label={`Delete ${c.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={submitContact} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-[8rem] flex-1 flex-col text-xs font-medium text-stone-600">
            Name
            <input type="text" required maxLength={100} placeholder="Dr. Sharma" value={cName} onChange={(e) => setCName(e.target.value)} className={cn(inputCls, 'mt-1')} />
          </label>
          <label className="flex w-28 flex-col text-xs font-medium text-stone-600">
            Relation
            <input type="text" maxLength={60} placeholder="Pediatrician" value={cRelation} onChange={(e) => setCRelation(e.target.value)} className={cn(inputCls, 'mt-1')} />
          </label>
          <label className="flex w-40 flex-col text-xs font-medium text-stone-600">
            Phone
            <input type="tel" required maxLength={30} placeholder="+91…" value={cPhone} onChange={(e) => setCPhone(e.target.value)} className={cn(inputCls, 'mt-1')} />
          </label>
          <Button type="submit" size="sm" disabled={cSaving}>
            <Plus className="h-4 w-4" />
            {cSaving ? 'Adding…' : 'Add'}
          </Button>
        </form>
      </Card>

      {/* Privacy & data (DPDP) */}
      <Card className="mt-4 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-stone-500" />
          <h2 className="font-bold text-stone-800">Privacy &amp; your data</h2>
        </div>
        <p className="mt-2 text-sm text-stone-600">
          You consented to storing your baby&apos;s health data when you signed up. It is private to your account and never used for
          ads or analytics. Under the DPDP Act you can take it with you or erase it at any time.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => void handleExport()} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? 'Preparing…' : 'Export my data'}
          </Button>
        </div>

        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-rose-600" />
            <h3 className="text-sm font-bold text-rose-700">Delete account</h3>
          </div>
          <p className="mt-1 text-xs text-rose-700/90">
            Permanently erases your account and every record for all of your babies. This cannot be undone.
          </p>
          <button
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </Card>
    </div>
  );
}
