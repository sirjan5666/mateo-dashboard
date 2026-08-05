import { useEffect, useRef, useState } from 'react';
import { Building2, Calendar, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { useActiveLocation } from '../../../../lib/doctorLocation';
import type { ClinicLocation } from '../../../../lib/doctorLocation';
import { cn } from '../../../../lib/cn';

export const INPUT =
  'h-12 w-full rounded-[10px] border border-[#E4E8F1] bg-white px-[15px] text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,79,224,.12)]';
export const INPUT_ERR = 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[rgba(239,68,68,.12)]';

export function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-[13px] font-bold text-[#334155]">
      {children}
      {required && (
        <span aria-hidden="true" className="ml-1 text-[#EF4444]">
          *
        </span>
      )}
    </label>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-[#EF4444]">
      {message}
    </p>
  );
}

/** Country code + masked national number in one bordered control. */
export function PhoneNumberInput({
  value,
  onChange,
  error,
  describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const codes = [
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+971', country: 'UAE', flag: '🇦🇪' },
    { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
    { code: '+1', country: 'United States', flag: '🇺🇸' },
    { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  ];
  const [code, setCode] = useState(codes[0]);

  // XXXXX XXXXX as you type.
  const format = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 10);
    return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
  };

  return (
    <div className={cn('relative flex h-12 items-stretch rounded-[10px] border border-[#E4E8F1] bg-white focus-within:border-[#3B4FE0] focus-within:ring-[3px] focus-within:ring-[rgba(59,79,224,.12)]', error && INPUT_ERR)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Country code, currently ${code.code}`}
        aria-expanded={open}
        className="flex w-[86px] shrink-0 items-center gap-1.5 border-r border-[#E4E8F1] pl-3 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5]"
      >
        <span aria-hidden="true" className="text-base leading-none">
          {code.flag}
        </span>
        <span className="text-sm font-semibold text-[#0F172A]">{code.code}</span>
        <ChevronDown className="ml-auto h-[15px] w-[15px] shrink-0 text-[#94A3B8]" />
      </button>

      <input
        id="phone"
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(format(e.target.value))}
        aria-describedby={describedBy}
        aria-invalid={error || undefined}
        className="min-w-0 flex-1 rounded-r-[10px] bg-transparent px-[15px] text-sm font-medium text-[#0F172A] focus:outline-none"
      />

      {open && (
        <ul className="absolute left-0 top-[calc(100%+6px)] z-30 w-56 rounded-[12px] border border-[#ECEEF4] bg-white p-1.5 shadow-[0_20px_48px_-16px_rgba(15,23,42,.3)]">
          {codes.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => {
                  setCode(c);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium text-[#0F172A] hover:bg-[#F6F7FB]"
              >
                <span aria-hidden="true">{c.flag}</span>
                {c.country}
                <span className="ml-auto text-[#64748B]">{c.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Rich clinic picker: avatar + name + single-line address. */
export function PrimaryLocationSelect({
  value,
  onChange,
}: {
  value: ClinicLocation;
  onChange: (l: ClinicLocation) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { clinics } = useActiveLocation();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id="primary-location"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-[72px] w-full items-center gap-3.5 rounded-[10px] border border-[#E4E8F1] bg-white px-4 text-left transition-colors hover:bg-[#FAFBFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
      >
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: value.tint }}>
          <Building2 className="h-5 w-5" style={{ color: value.hue }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-[#0F172A]">{value.name}</span>
          <span className="mt-[3px] block truncate text-[12.5px] text-[#64748B]">
            {value.addressLine}, {value.cityLine}
          </span>
        </span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-[#64748B] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <ul role="listbox" aria-label="Primary location" className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[300px] overflow-y-auto rounded-[12px] border border-[#ECEEF4] bg-white p-1.5 shadow-[0_20px_48px_-16px_rgba(15,23,42,.3)]">
          {clinics.map((c) => (
            <li key={c.id} role="option" aria-selected={c.id === value.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className={cn('flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2.5 text-left', c.id === value.id ? 'bg-[#F5F5FF]' : 'hover:bg-[#F6F7FB]')}
              >
                <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: c.tint }}>
                  <Building2 className="h-[18px] w-[18px]" style={{ color: c.hue }} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-bold text-[#0F172A]">{c.name}</span>
                  <span className="block truncate text-[12px] text-[#64748B]">{c.cityLine}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUSES = [
  { value: 'active', label: 'Active', dot: '#16A34A' },
  { value: 'inactive', label: 'Inactive', dot: '#94A3B8' },
  { value: 'suspended', label: 'Suspended', dot: '#F59E0B' },
];

export function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const current = STATUSES.find((s) => s.value === value) ?? STATUSES[0];
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute left-[15px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full" style={{ background: current.dot }} />
      <select
        id="status"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT, 'appearance-none pl-7 pr-10 font-semibold')}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-[15px] top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#94A3B8]" />
    </div>
  );
}

export function DateInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Calendar aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#64748B]" />
      <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={cn(INPUT, 'pl-11')} />
    </div>
  );
}

export function PasswordInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id="password"
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={error ? 'password-error password-help' : 'password-help'}
        aria-invalid={error ? true : undefined}
        className={cn(INPUT, 'pr-12 tracking-[0.18em]', error && INPUT_ERR)}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="absolute right-[15px] top-1/2 -translate-y-1/2 text-[#64748B] transition-colors hover:text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5]"
      >
        {shown ? <EyeOff className="h-[19px] w-[19px]" /> : <Eye className="h-[19px] w-[19px]" />}
      </button>
    </div>
  );
}
