import { useState } from 'react';
import { ChevronDown, ExternalLink, Settings as Gear, ShieldCheck } from 'lucide-react';
import { PhoneNumberInput } from '../../components/doctor/v2/subuser/fields';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const INPUT = 'h-[46px] w-full rounded-[10px] border border-[#E4E8F1] bg-white px-[15px] text-[13.5px] font-medium text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,79,224,.12)]';
const LABEL = 'mb-2 block text-[12.5px] font-bold text-[#334155]';

const TABS = ['General', 'Clinic Profile', 'Users & Permissions', 'Appointment Settings', 'Billing & Payments', 'Notifications', 'Integrations', 'Security'];

/** Only "Enable Dark Mode" starts off; the other six are on. */
const PREFERENCES = [
  { id: 'dark', title: 'Enable Dark Mode', desc: 'Switch between light and dark theme', on: false },
  { id: 'portal', title: 'Enable Patient Dashboard', desc: 'Allow patients to access their portal', on: true },
  { id: 'autoid', title: 'Auto-generate Patient ID', desc: 'Automatically generate unique patient IDs', on: true },
  { id: 'reminders', title: 'Appointment Reminders', desc: 'Send SMS/Email reminders to patients', on: true },
  { id: 'whatsapp', title: 'Enable WhatsApp Notifications', desc: 'Send notifications via WhatsApp', on: true },
  { id: 'booking', title: 'Allow Online Booking', desc: 'Allow patients to book appointments online', on: true },
  { id: 'backup', title: 'Enable Data Backup', desc: 'Automatically backup data daily', on: true },
];

const HOURS = [
  ['Monday', '09:00 AM - 08:00 PM'], ['Tuesday', '09:00 AM - 08:00 PM'], ['Wednesday', '09:00 AM - 08:00 PM'],
  ['Thursday', '09:00 AM - 08:00 PM'], ['Friday', '09:00 AM - 08:00 PM'], ['Saturday', '09:00 AM - 02:00 PM'],
  ['Sunday', 'Closed'],
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

export default function SettingsPage() {
  const [tab, setTab] = useState('General');
  const [prefs, setPrefs] = useState(() => Object.fromEntries(PREFERENCES.map((p) => [p.id, p.on])));
  const [timeFormat, setTimeFormat] = useState<'12' | '24'>('12');
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [phone, setPhone] = useState('98765 43210');

  const toggle = (id: string) => {
    setPrefs((p) => ({ ...p, [id]: !p[id] }));
    setDirty(true);
    if (id === 'dark') document.documentElement.classList.toggle('dark', !prefs.dark);
  };

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

      {tab !== 'General' ? (
        <div className={`${CARD} grid place-items-center px-6 py-20 text-center`}>
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F172A]">{tab}</h2>
            <p className="mt-2 text-sm text-[#64748B]">This settings panel is coming soon.</p>
          </div>
        </div>
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
                      <input id="clinicName" defaultValue="Greenview Children Clinic" onChange={() => setDirty(true)} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="clinicEmail" className={LABEL}>Clinic Email</label>
                      <input id="clinicEmail" type="email" defaultValue="info@greenviewclinic.com" onChange={() => setDirty(true)} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="phone" className={LABEL}>Phone Number</label>
                      <PhoneNumberInput value={phone} onChange={(v) => { setPhone(v); setDirty(true); }} />
                    </div>
                    <div>
                      <label htmlFor="tz" className={LABEL}>Time Zone</label>
                      <div className="relative">
                        <select id="tz" onChange={() => setDirty(true)} className={cn(INPUT, 'appearance-none pr-10')}>
                          <option>(GMT +05:30) Asia/Kolkata</option>
                          <option>(GMT +04:00) Asia/Dubai</option>
                        </select>
                        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#94A3B8]" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="dateFmt" className={LABEL}>Date Format</label>
                      <div className="relative">
                        <select id="dateFmt" onChange={() => setDirty(true)} className={cn(INPUT, 'appearance-none pr-10')}>
                          <option>DD MMM YYYY (e.g. 12 May 2025)</option>
                          <option>DD/MM/YYYY (e.g. 12/05/2025)</option>
                        </select>
                        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#94A3B8]" />
                      </div>
                    </div>

                    <fieldset>
                      <legend className={LABEL}>Time Format</legend>
                      <div role="radiogroup" aria-label="Time Format" className="mt-1 flex flex-wrap gap-10">
                        {([['12', '12 Hour (e.g. 02:30 PM)', 'radio'], ['24', '24 Hour (e.g. 14:30)', 'square']] as const).map(([v, label, shape]) => {
                          const on = timeFormat === v;
                          return (
                            <button key={v} role="radio" type="button" aria-checked={on} onClick={() => { setTimeFormat(v); setDirty(true); }} className="flex items-center gap-[11px]">
                              {/* The reference draws the unselected option as a square. Shape is
                                  cosmetic only — both are radios in the same group. */}
                              <span aria-hidden="true" className={cn('grid h-[18px] w-[18px] shrink-0 place-items-center border-2',
                                shape === 'radio' || on ? 'rounded-full' : 'rounded-[5px] border-[1.5px]',
                                on ? 'border-[#3B4FE0]' : 'border-[#C7CEDB]')}>
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
                        <div className="relative">
                          <select id="currency" onChange={() => setDirty(true)} className={cn(INPUT, 'appearance-none pr-10')}>
                            <option>₹ INR - Indian Rupee</option>
                            <option>$ USD - US Dollar</option>
                          </select>
                          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#94A3B8]" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="lang" className={LABEL}>Language</label>
                        <div className="relative">
                          <select id="lang" onChange={() => setDirty(true)} className={cn(INPUT, 'appearance-none pr-10')}>
                            <option>English</option>
                            <option>हिन्दी</option>
                          </select>
                          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#94A3B8]" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="defaultPage" className={LABEL}>Default Page</label>
                      <div className="relative">
                        <select id="defaultPage" onChange={() => setDirty(true)} className={cn(INPUT, 'appearance-none pr-10')}>
                          <option>Dashboard</option><option>Appointments</option><option>Patients</option>
                        </select>
                        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#94A3B8]" />
                      </div>
                    </div>
                  </div>

                  <button type="button" disabled={!dirty} onClick={() => { setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2500); }}
                    className="mt-[26px] h-[46px] rounded-[10px] bg-[#4F46E5] px-[26px] text-sm font-bold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50">
                    Save Changes
                  </button>
                  <p aria-live="polite" className="sr-only">{saved ? 'Settings saved' : ''}</p>
                </div>

                {/* System Preferences */}
                <div className="min-w-0 lg:pl-11">
                  <h2 className="mb-5 font-display text-[16.5px] font-bold text-[#0F172A]">System Preferences</h2>
                  <div>
                    {PREFERENCES.map((p, i) => (
                      <div key={p.id} className={cn('flex items-center gap-4 py-4', i > 0 && 'border-t border-[#F1F3F9]')}>
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-bold text-[#0F172A]">{p.title}</p>
                          <p id={`${p.id}-desc`} className="mt-[3px] text-[12.5px] text-[#64748B]">{p.desc}</p>
                        </div>
                        <span className="ml-auto"><Switch on={prefs[p.id]} onToggle={() => toggle(p.id)} title={p.title} descId={`${p.id}-desc`} /></span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-[22px]">
                    <p className="text-[13.5px] font-bold text-[#0F172A]">Session Timeout</p>
                    <p className="mt-[3px] text-[12.5px] text-[#64748B]">Automatically log out after a period of inactivity</p>
                    <div className="relative mt-3 w-[152px]">
                      <label htmlFor="timeout" className="sr-only">Session timeout</label>
                      <select id="timeout" onChange={() => setDirty(true)} className="h-11 w-full appearance-none rounded-[10px] border border-[#E4E8F1] bg-white pl-3.5 pr-9 text-[13.5px] font-medium text-[#0F172A] focus:outline-none">
                        {['15 Minutes', '30 Minutes', '1 Hour', '2 Hours', 'Never'].map((o) => <option key={o} selected={o === '30 Minutes'}>{o}</option>)}
                      </select>
                      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                    </div>
                  </div>
                </div>
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

          {/* ── Right rail ── */}
          <div className="flex min-w-0 flex-col gap-[18px]">
            <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
              <h2 className="font-display text-[15.5px] font-bold text-[#0F172A]">Clinic Logo</h2>
              <p className="mt-[5px] text-[12.5px] text-[#64748B]">Upload your clinic logo. Recommended size: 512x512px</p>
              <div className="mt-3.5 grid h-[132px] place-items-center rounded-[11px] border border-[#ECEEF4] bg-[#F7F8FC]">
                <svg viewBox="0 0 120 90" role="img" aria-label="Greenview Children Clinic logo" className="h-[104px]">
                  <path d="M52 12h16v10h10v16H68v10H52V38H42V22h10z" fill="#12805A" />
                  <path d="M78 20c8 0 14 5 14 12s-7 12-15 11c0-8 4-16 1-23z" fill="#34A853" opacity=".85" />
                  <text x="60" y="66" textAnchor="middle" fontSize="12" fontWeight="700" fill="#12805A" fontFamily="Georgia, serif">GREENVIEW</text>
                  <text x="60" y="80" textAnchor="middle" fontSize="9" fontWeight="600" fill="#12805A" fontFamily="Georgia, serif">CHILDREN CLINIC</text>
                </svg>
              </div>
            </section>

            <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
              <div className="flex items-center">
                <h2 className="font-display text-[15.5px] font-bold text-[#0F172A]">Business Hours</h2>
                <button type="button" className="ml-auto text-[13px] font-bold text-[#3B4FE0] hover:underline">Edit</button>
              </div>
              <dl className="mt-3.5">
                {HOURS.map(([day, hrs]) => (
                  <div key={day} className="flex h-[30px] items-center justify-between gap-3">
                    <dt className="text-[12.5px] font-medium text-[#475569]">{day}</dt>
                    <dd className={cn('text-[12.5px] tabular-nums', hrs === 'Closed' ? 'font-bold text-[#E03131]' : 'font-semibold text-[#0F172A]')}>{hrs}</dd>
                  </div>
                ))}
              </dl>
            </section>

          </div>
        </div>
      )}
    </div>
  );
}
