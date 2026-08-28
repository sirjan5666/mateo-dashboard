import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, ChevronDown, ExternalLink, Loader2, Settings as Gear, ShieldCheck } from 'lucide-react';
import { PhoneNumberInput } from '../../components/doctor/v2/subuser/fields';
import { getSettings, saveSettings } from '../../api/doctorSettings';
import type { ClinicPreferences, ClinicSettings } from '../../api/doctorSettings';
import { WEEK_DAYS } from '../../api/doctors';
import type { DayHours, WeekDay } from '../../api/doctors';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const INPUT = 'h-[46px] w-full rounded-[10px] border border-[#E4E8F1] bg-white px-[15px] text-[13.5px] font-medium text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,79,224,.12)]';
const LABEL = 'mb-2 block text-[12.5px] font-bold text-[#334155]';

const TABS = ['General', 'Clinic Profile', 'Users & Permissions', 'Appointment Settings', 'Billing & Payments', 'Notifications', 'Integrations', 'Security'];

/**
 * Most settings sections are surfaces onto features that already exist elsewhere
 * in the app — so instead of a dead "coming soon", each tab explains what it
 * covers and links straight to the real screen. Only genuinely-unbuilt areas
 * (Integrations, and deeper Security) are marked as planned.
 */
const SECTION_LINKS: Record<string, { desc: string; items: string[]; to?: string; linkLabel?: string; planned?: string }> = {
  'Clinic Profile': {
    desc: 'Your professional profile and clinic details.',
    items: ['Speciality, qualifications & registration', 'Clinic name, address & city', 'Working hours', 'Bank details for payouts'],
    to: '/doctor/profile', linkLabel: 'Open clinic profile',
  },
  'Users & Permissions': {
    desc: 'Your team and what each member can access.',
    items: ['Add / invite staff members', 'Roles with per-module permissions', 'Per-person permission exceptions'],
    to: '/doctor/team', linkLabel: 'Manage team & roles',
  },
  'Appointment Settings': {
    desc: 'How patients can book time with you.',
    items: ['Available days & booking window', 'Slot length', 'Working hours per day'],
    to: '/doctor/profile', linkLabel: 'Edit availability',
  },
  'Billing & Payments': {
    desc: 'Invoices, collections and outstanding balances.',
    items: ['All invoices & their status', 'Revenue over time', 'Record payments'],
    to: '/doctor/revenue', linkLabel: 'Open revenue',
  },
  'Notifications': {
    desc: 'Which alerts you receive, and how.',
    items: ['Email notifications', 'WhatsApp / SMS notifications', 'Appointment reminders'],
    to: '/doctor/profile', linkLabel: 'Notification preferences',
  },
  Integrations: {
    desc: 'Connect external services.',
    items: ['Lab & diagnostics partners', 'Pharmacy / distributor feeds', 'Messaging (WhatsApp Business)'],
    planned: 'Integrations are on the roadmap — tell us which service you need first.',
  },
  Security: {
    desc: 'Account protection.',
    items: ['Change password', 'Active sessions', 'Audit log of account activity'],
    to: '/doctor/audit', linkLabel: 'View audit logs',
    planned: 'Password & session controls are being built; for now, account activity is in Audit Logs.',
  },
};

/** Dark mode is a per-device display choice, kept client-side — never sent to the server. */
const DARK_KEY = 'mateo:doctor-dark';

/**
 * The System Preferences switches, each bound to one persisted preference. Dark
 * mode is deliberately absent — it is a device setting, handled separately.
 */
const TOGGLES: { key: keyof ClinicPreferences; title: string; desc: string }[] = [
  { key: 'patientPortal', title: 'Enable Patient Dashboard', desc: 'Allow patients to access their portal' },
  { key: 'autoPatientId', title: 'Auto-generate Patient ID', desc: 'Assign the next patient number automatically' },
  { key: 'appointmentReminders', title: 'Appointment Reminders', desc: 'Send SMS/Email reminders to patients' },
  { key: 'whatsappNotifications', title: 'Enable WhatsApp Notifications', desc: 'Send notifications via WhatsApp' },
  { key: 'onlineBooking', title: 'Allow Online Booking', desc: 'Allow patients to book appointments online' },
  { key: 'dataBackup', title: 'Enable Data Backup', desc: 'Automatically back up data daily' },
];

const DAY_LABEL: Record<WeekDay, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const TIMEOUTS = [
  { v: 15, label: '15 Minutes' }, { v: 30, label: '30 Minutes' }, { v: 60, label: '1 Hour' },
  { v: 120, label: '2 Hours' }, { v: 0, label: 'Never' },
];

function Switch({ on, onToggle, title, descId }: { on: boolean; onToggle: () => void; title: string; descId: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-describedby={descId} onClick={onToggle}
      className={cn('relative h-[23px] w-[42px] shrink-0 rounded-full transition-colors duration-[180ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2', on ? 'bg-[#4F46E5]' : 'bg-[#E2E6F0]')}
    >
      <span className="sr-only">{title}</span>
      <span className={cn('absolute top-[2.5px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-[left] duration-[180ms]', on ? 'left-[21px]' : 'left-[2.5px]')} />
    </button>
  );
}

function Select({ id, value, onChange, options }: {
  id: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(INPUT, 'appearance-none pr-10')}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#94A3B8]" />
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState('General');
  const [data, setData] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The editable copy. Split out so an in-progress edit is obvious (`dirty`).
  const [clinic, setClinic] = useState<{ name: string; email: string; phone: string }>({ name: '', email: '', phone: '' });
  const [hours, setHours] = useState<Record<WeekDay, DayHours>>({} as Record<WeekDay, DayHours>);
  const [prefs, setPrefs] = useState<ClinicPreferences | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [dark, setDark] = useState(() => localStorage.getItem(DARK_KEY) === '1');

  useEffect(() => {
    let cancelled = false;
    void getSettings()
      .then((s) => {
        if (cancelled) return;
        setData(s);
        setClinic(s.clinic ? { name: s.clinic.name, email: s.clinic.email, phone: s.clinic.phone } : { name: '', email: '', phone: '' });
        setHours(s.workingHours);
        setPrefs(s.preferences);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load settings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const touch = () => { setDirty(true); setSaved(false); };
  const setPref = <K extends keyof ClinicPreferences>(key: K, value: ClinicPreferences[K]) => {
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
    touch();
  };
  const setDay = (day: WeekDay, patch: Partial<DayHours>) => {
    setHours((h) => ({ ...h, [day]: { ...h[day], ...patch } }));
    touch();
  };
  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem(DARK_KEY, next ? '1' : '0');
      return next;
    });
  };

  async function save() {
    if (!prefs) return;
    setSaving(true);
    setSaveError(null);
    try {
      const fresh = await saveSettings({
        // Only send the clinic block if there is a clinic to save it to.
        ...(data?.clinic ? { clinic: { name: clinic.name.trim(), email: clinic.email.trim(), phone: clinic.phone.trim() } } : {}),
        workingHours: hours,
        preferences: prefs,
      });
      setData(fresh);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-[18px] flex items-start gap-[15px]">
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px]" style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
          <Gear className="h-[22px] w-[22px] text-white" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">Settings</h1>
          <p className="mt-1.5 text-sm text-[#64748B]">Manage your clinic preferences and system configuration.</p>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Settings sections" className="mb-[18px] flex gap-[34px] overflow-x-auto border-b border-[#E4E8F1]">
        {TABS.map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              const i = TABS.indexOf(tab);
              if (e.key === 'ArrowRight') setTab(TABS[(i + 1) % TABS.length]);
              if (e.key === 'ArrowLeft') setTab(TABS[(i - 1 + TABS.length) % TABS.length]);
              if (e.key === 'Home') setTab(TABS[0]);
              if (e.key === 'End') setTab(TABS[TABS.length - 1]);
            }}
            className={cn('shrink-0 whitespace-nowrap border-b-[2.5px] pb-3.5 text-[13.5px] transition-colors',
              tab === t ? 'border-[#3B4FE0] font-bold text-[#3B4FE0]' : 'border-transparent font-medium text-[#64748B] hover:text-[#334155]')}>
            {t}
          </button>
        ))}
      </div>

      {saveError && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">{saveError}</p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 py-16 text-sm text-[#64748B]">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Loading settings…
        </p>
      ) : loadError || !prefs ? (
        <p role="alert" className="rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
          {loadError ?? 'Could not load settings.'}
        </p>
      ) : tab !== 'General' ? (
        (() => {
          const s = SECTION_LINKS[tab];
          return (
            <div className={`${CARD} max-w-2xl px-6 py-7`}>
              <h2 className="font-display text-lg font-bold text-[#0F172A]">{tab}</h2>
              {s && <p className="mt-1.5 text-sm text-[#64748B]">{s.desc}</p>}
              {s && (
                <ul className="mt-4 flex flex-col gap-2.5">
                  {s.items.map((it) => (
                    <li key={it} className="flex items-center gap-2.5 text-[13.5px] text-[#334155]">
                      <Check className="h-4 w-4 shrink-0 text-[#12A150]" />{it}
                    </li>
                  ))}
                </ul>
              )}
              {s?.planned && (
                <p className="mt-4 rounded-[10px] border border-[#F8E3B8] bg-[#FEF8EC] px-4 py-2.5 text-[12.5px] text-[#8A5A0B]">{s.planned}</p>
              )}
              {s?.to && (
                <Link to={s.to} className="mt-5 inline-flex h-11 items-center gap-2 rounded-[10px] px-5 text-[13.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105"
                  style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
                  {s.linkLabel ?? 'Open'}<ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          );
        })()
      ) : (
        <div role="tabpanel" className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_372px]">
          <div className="min-w-0">
            <div className={`${CARD} px-6 pb-[26px] pt-[22px]`}>
              <div className="grid grid-cols-1 gap-x-11 gap-y-8 lg:grid-cols-2 lg:divide-x lg:divide-[#ECEEF4]">
                {/* General Settings */}
                <div className="min-w-0">
                  <h2 className="mb-5 font-display text-[16.5px] font-bold text-[#0F172A]">General Settings</h2>
                  <div className="flex flex-col gap-[18px]">
                    <div>
                      <label htmlFor="clinicName" className={LABEL}>Clinic Name</label>
                      <input id="clinicName" value={clinic.name} disabled={!data?.clinic}
                        onChange={(e) => { setClinic((c) => ({ ...c, name: e.target.value })); touch(); }}
                        className={cn(INPUT, !data?.clinic && 'cursor-not-allowed bg-[#F9FAFD] text-[#94A3B8]')} />
                    </div>
                    <div>
                      <label htmlFor="clinicEmail" className={LABEL}>Clinic Email</label>
                      <input id="clinicEmail" type="email" value={clinic.email} disabled={!data?.clinic}
                        onChange={(e) => { setClinic((c) => ({ ...c, email: e.target.value })); touch(); }}
                        className={cn(INPUT, !data?.clinic && 'cursor-not-allowed bg-[#F9FAFD] text-[#94A3B8]')} />
                    </div>
                    <div>
                      <label htmlFor="phone" className={LABEL}>Phone Number</label>
                      <PhoneNumberInput value={clinic.phone} onChange={(v) => { setClinic((c) => ({ ...c, phone: v })); touch(); }} />
                    </div>
                    {!data?.clinic && (
                      <p className="-mt-2 text-[12px] text-[#94A3B8]">
                        Add a clinic under Locations to set its name, email and phone.
                      </p>
                    )}

                    <div>
                      <label htmlFor="dateFmt" className={LABEL}>Date Format</label>
                      <Select id="dateFmt" value={prefs.dateFormat} onChange={(v) => setPref('dateFormat', v as ClinicPreferences['dateFormat'])}
                        options={[{ value: 'DD MMM YYYY', label: 'DD MMM YYYY (e.g. 12 May 2025)' }, { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 12/05/2025)' }]} />
                    </div>

                    <fieldset>
                      <legend className={LABEL}>Time Format</legend>
                      <div role="radiogroup" aria-label="Time Format" className="mt-1 flex flex-wrap gap-10">
                        {([['12', '12 Hour (e.g. 02:30 PM)'], ['24', '24 Hour (e.g. 14:30)']] as const).map(([v, label]) => {
                          const on = prefs.timeFormat === v;
                          return (
                            <button key={v} role="radio" type="button" aria-checked={on} onClick={() => setPref('timeFormat', v)} className="flex items-center gap-[11px]">
                              <span aria-hidden="true" className={cn('grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2', on ? 'border-[#3B4FE0]' : 'border-[#C7CEDB]')}>
                                {on && <span className="h-2 w-2 rounded-full bg-[#3B4FE0]" />}
                              </span>
                              <span className="text-[13px] font-medium text-[#334155]">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="currency" className={LABEL}>Currency</label>
                        <Select id="currency" value={prefs.currency} onChange={(v) => setPref('currency', v)}
                          options={[{ value: 'INR', label: '₹ INR - Indian Rupee' }, { value: 'USD', label: '$ USD - US Dollar' }]} />
                      </div>
                      <div>
                        <label htmlFor="lang" className={LABEL}>Language</label>
                        <Select id="lang" value={prefs.language} onChange={(v) => setPref('language', v as ClinicPreferences['language'])}
                          options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'हिन्दी' }]} />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="defaultPage" className={LABEL}>Default Page</label>
                      <Select id="defaultPage" value={prefs.defaultPage} onChange={(v) => setPref('defaultPage', v as ClinicPreferences['defaultPage'])}
                        options={[{ value: 'dashboard', label: 'Dashboard' }, { value: 'appointments', label: 'Appointments' }, { value: 'patients', label: 'Patients' }]} />
                    </div>
                  </div>
                </div>

                {/* System Preferences */}
                <div className="min-w-0 lg:pl-11">
                  <h2 className="mb-5 font-display text-[16.5px] font-bold text-[#0F172A]">System Preferences</h2>
                  <div>
                    <div className="flex items-center gap-4 py-4">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-bold text-[#0F172A]">Enable Dark Mode</p>
                        <p id="dark-desc" className="mt-[3px] text-[12.5px] text-[#64748B]">Switch between light and dark theme on this device</p>
                      </div>
                      <span className="ml-auto"><Switch on={dark} onToggle={toggleDark} title="Enable Dark Mode" descId="dark-desc" /></span>
                    </div>
                    {TOGGLES.map((t) => (
                      <div key={t.key} className="flex items-center gap-4 border-t border-[#F1F3F9] py-4">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-bold text-[#0F172A]">{t.title}</p>
                          <p id={`${t.key}-desc`} className="mt-[3px] text-[12.5px] text-[#64748B]">{t.desc}</p>
                        </div>
                        <span className="ml-auto">
                          <Switch on={prefs[t.key] as boolean} onToggle={() => setPref(t.key, !prefs[t.key] as never)} title={t.title} descId={`${t.key}-desc`} />
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-[22px]">
                    <p className="text-[13.5px] font-bold text-[#0F172A]">Session Timeout</p>
                    <p className="mt-[3px] text-[12.5px] text-[#64748B]">Automatically log out after a period of inactivity</p>
                    <div className="relative mt-3 w-[152px]">
                      <label htmlFor="timeout" className="sr-only">Session timeout</label>
                      <select id="timeout" value={prefs.sessionTimeoutMins} onChange={(e) => setPref('sessionTimeoutMins', Number(e.target.value))}
                        className="h-11 w-full appearance-none rounded-[10px] border border-[#E4E8F1] bg-white pl-3.5 pr-9 text-[13.5px] font-medium text-[#0F172A] focus:outline-none">
                        {TIMEOUTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                      </select>
                      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Save */}
              <div className="mt-[26px] flex items-center gap-3.5 border-t border-[#F1F3F9] pt-[22px]">
                <button type="button" disabled={!dirty || saving} onClick={() => void save()}
                  className="flex h-[46px] items-center gap-2 rounded-[10px] bg-[#4F46E5] px-[26px] text-sm font-bold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50">
                  {saving && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {saved && (
                  <span role="status" className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0F7A46]">
                    <Check className="h-4 w-4" /> Saved
                  </span>
                )}
                <p aria-live="polite" className="sr-only">{saved ? 'Settings saved' : ''}</p>
              </div>
            </div>

            {/* Privacy bar */}
            <div className="mt-[18px] flex flex-wrap items-center gap-3.5 rounded-[12px] bg-[#F0F2FE] px-5 py-4">
              <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-[#6D5AE0]" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#3B3FD8]">Your data is secure and encrypted.</p>
                <p className="mt-[3px] text-[12.5px] text-[#64748B]">We are committed to protecting your clinic and patient information.</p>
              </div>
              <a href="/privacy" className="ml-auto flex items-center gap-[7px] text-[12.5px] font-semibold text-[#3B4FE0] hover:underline">
                View Privacy Policy
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
          </div>

          {/* ── Right rail: Business Hours ── */}
          <div className="flex min-w-0 flex-col gap-[18px]">
            <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
              <h2 className="font-display text-[15.5px] font-bold text-[#0F172A]">Business Hours</h2>
              <p className="mt-[5px] text-[12.5px] text-[#64748B]">The hours patients can book. Saved with the button on the left.</p>
              <ul className="mt-3.5 flex flex-col gap-2.5">
                {WEEK_DAYS.map((day) => {
                  const d = hours[day];
                  if (!d) return null;
                  return (
                    <li key={day} className="flex items-center gap-2">
                      <span className="w-[74px] shrink-0 text-[12.5px] font-semibold text-[#334155]">{DAY_LABEL[day]}</span>
                      {d.closed ? (
                        <span className="flex-1 text-[12.5px] font-bold text-[#E03131]">Closed</span>
                      ) : (
                        <span className="flex flex-1 items-center gap-1.5">
                          <input type="time" value={d.start} aria-label={`${DAY_LABEL[day]} opening time`}
                            onChange={(e) => setDay(day, { start: e.target.value })}
                            className="h-9 w-full rounded-[8px] border border-[#E4E8F1] bg-white px-2 text-[12.5px] tabular-nums text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
                          <span className="text-[#94A3B8]">–</span>
                          <input type="time" value={d.end} aria-label={`${DAY_LABEL[day]} closing time`}
                            onChange={(e) => setDay(day, { end: e.target.value })}
                            className="h-9 w-full rounded-[8px] border border-[#E4E8F1] bg-white px-2 text-[12.5px] tabular-nums text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
                        </span>
                      )}
                      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11.5px] font-medium text-[#64748B]">
                        <input type="checkbox" checked={d.closed} onChange={(e) => setDay(day, { closed: e.target.checked })}
                          className="h-3.5 w-3.5 rounded border-[#C7CEDB] text-[#4F46E5] focus:ring-[#4F63F5]" />
                        Closed
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
