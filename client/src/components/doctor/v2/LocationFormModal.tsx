import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { createLocation, updateLocation } from '../../../api/doctorLocations';
import type { ClinicLocationDto, LocationInput } from '../../../api/doctorLocations';
import { ApiError } from '../../../api/client';
import { cn } from '../../../lib/cn';

const FIELD =
  'h-11 w-full rounded-[10px] border border-[#E4E8F1] bg-white px-3.5 text-[13.5px] font-medium text-[#0F172A] placeholder:font-normal placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none';
const LABEL = 'mb-[7px] block text-[12.5px] font-bold text-[#334155]';

const SUGGESTED = [
  'General Paediatrics', 'Vaccination', 'Growth Monitoring', 'Nutrition',
  'Development Assessment', 'Allergy Testing', 'Lactation Support', 'Emergency Care',
];

type Errors = Partial<Record<keyof LocationInput, string>>;

/** Mirrors the server's zod rules so the user sees the problem before the round-trip. */
function validate(v: LocationInput): Errors {
  const e: Errors = {};
  if (v.name.trim().length < 2) e.name = 'Enter the clinic name';
  if (!/^[a-zA-Z0-9-]{2,40}$/.test(v.code.trim())) e.code = 'Letters, numbers and hyphens only';
  if (v.addressLine.trim().length < 3) e.addressLine = 'Enter the street address';
  if (v.city.trim().length < 2) e.city = 'Enter the city';
  if (v.state.trim().length < 2) e.state = 'Enter the state';
  if (!/^\d{6}$/.test(v.pincode.trim())) e.pincode = 'Pincode must be 6 digits';
  if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) e.email = 'Enter a valid email';
  return e;
}

const BLANK: LocationInput = {
  name: '', code: '', addressLine: '', city: '', state: '', pincode: '',
  phone: '', email: '', services: [], openingHours: '', drugLicenceNo: '', gstin: '',
};

/** Add New Location, and the same form in edit mode from the row menu. */
/** Field-level error text, hoisted so it is not re-created on every render. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1.5 text-[11.5px] font-medium text-[#E03131]">{message}</p>;
}

/** Mounted only while open — see LocationFormModal below. */
function LocationForm({
  editing,
  onClose,
  onSaved,
}: {
  editing?: ClinicLocationDto | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<LocationInput>(() =>
    editing
      ? {
          name: editing.name, code: editing.code, addressLine: editing.addressLine,
          city: editing.city, state: editing.state, pincode: editing.pincode,
          phone: editing.phone ?? '', email: editing.email ?? '',
          services: editing.services, openingHours: editing.openingHours ?? '',
          drugLicenceNo: editing.drugLicenceNo ?? '', gstin: editing.gstin ?? '',
        }
      : BLANK,
  );
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const set = <K extends keyof LocationInput>(k: K, v: LocationInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const toggleService = (s: string) =>
    setForm((f) => ({
      ...f,
      services: f.services?.includes(s) ? f.services.filter((x) => x !== s) : [...(f.services ?? []), s],
    }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setServerError(null);
    try {
      if (editing) await updateLocation(editing.id, form);
      else await createLocation(form);
      await onSaved();
      onClose();
    } catch (err) {
      // 409 is the unique (doctor, code) index — a duplicate clinic code.
      setServerError(
        err instanceof ApiError && err.status === 409
          ? 'A clinic with this code already exists — pick a different code.'
          : err instanceof Error ? err.message : 'Could not save this location',
      );
      setSaving(false);
    }
  }

  const inputProps = (k: keyof LocationInput) => ({
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `err-${k}` : undefined,
    className: cn(FIELD, errors[k] && 'border-[#E03131]'),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(10,27,77,.45)] p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loc-form-title"
        className="relative max-h-full w-full max-w-[680px] overflow-y-auto rounded-[16px] bg-white shadow-[0_28px_64px_-20px_rgba(15,23,42,.4)]"
      >
        <div className="flex items-start gap-3 border-b border-[#ECEEF4] px-6 py-5">
          <div className="min-w-0">
            <h2 id="loc-form-title" className="font-display text-[19px] font-extrabold tracking-[-0.02em] text-[#0F172A]">
              {editing ? 'Edit Location' : 'Add New Location'}
            </h2>
            <p className="mt-1 text-[13px] text-[#64748B]">
              {editing ? 'Update this clinic’s details.' : 'Add a clinic you practise at.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[#64748B] hover:bg-[#F1F3F9]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lf-name" className={LABEL}>Clinic Name <span aria-hidden="true" className="text-[#EF4444]">*</span></label>
              <input id="lf-name" ref={firstRef} autoFocus value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="Greenview Children Clinic" {...inputProps('name')} />
              <FieldError id="err-name" message={errors.name} />
            </div>
            <div>
              <label htmlFor="lf-code" className={LABEL}>Short Code <span aria-hidden="true" className="text-[#EF4444]">*</span></label>
              <input id="lf-code" value={form.code} onChange={(e) => set('code', e.target.value)}
                placeholder="greenview" disabled={!!editing} {...inputProps('code')} />
              <FieldError id="err-code" message={errors.code} />
              {editing && <p className="mt-1.5 text-[11.5px] text-[#94A3B8]">The code cannot change after a clinic is created.</p>}
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="lf-addr" className={LABEL}>Street Address <span aria-hidden="true" className="text-[#EF4444]">*</span></label>
            <input id="lf-addr" value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)}
              placeholder="23, Green Park Main" {...inputProps('addressLine')} />
            <FieldError id="err-addressLine" message={errors.addressLine} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="lf-city" className={LABEL}>City <span aria-hidden="true" className="text-[#EF4444]">*</span></label>
              <input id="lf-city" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="New Delhi" {...inputProps('city')} />
              <FieldError id="err-city" message={errors.city} />
            </div>
            <div>
              <label htmlFor="lf-state" className={LABEL}>State <span aria-hidden="true" className="text-[#EF4444]">*</span></label>
              <input id="lf-state" value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="Delhi" {...inputProps('state')} />
              <FieldError id="err-state" message={errors.state} />
            </div>
            <div>
              <label htmlFor="lf-pin" className={LABEL}>Pincode <span aria-hidden="true" className="text-[#EF4444]">*</span></label>
              <input id="lf-pin" inputMode="numeric" value={form.pincode} onChange={(e) => set('pincode', e.target.value)}
                placeholder="110016" {...inputProps('pincode')} />
              <FieldError id="err-pincode" message={errors.pincode} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lf-phone" className={LABEL}>Phone</label>
              <input id="lf-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 11 4100 2266" {...inputProps('phone')} />
            </div>
            <div>
              <label htmlFor="lf-email" className={LABEL}>Email</label>
              <input id="lf-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="info@clinic.com" {...inputProps('email')} />
              <FieldError id="err-email" message={errors.email} />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="lf-hours" className={LABEL}>Opening Hours</label>
            <input id="lf-hours" value={form.openingHours} onChange={(e) => set('openingHours', e.target.value)}
              placeholder="Mon–Sat, 09:00 AM – 09:00 PM" {...inputProps('openingHours')} />
          </div>

          {/* Printed verbatim on pharmacy invoices — left blank, nothing is printed. */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lf-licence" className={LABEL}>Drug Licence No.</label>
              <input id="lf-licence" value={form.drugLicenceNo} onChange={(e) => set('drugLicenceNo', e.target.value)}
                placeholder="As issued by the state authority" {...inputProps('drugLicenceNo')} />
            </div>
            <div>
              <label htmlFor="lf-gstin" className={LABEL}>GSTIN</label>
              <input id="lf-gstin" value={form.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                placeholder="15-character GSTIN" {...inputProps('gstin')} />
            </div>
          </div>

          <fieldset className="mt-4">
            <legend className={LABEL}>Services Offered</legend>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((s) => {
                const on = form.services?.includes(s) ?? false;
                return (
                  <button key={s} type="button" role="switch" aria-checked={on} onClick={() => toggleService(s)}
                    className={cn('h-9 rounded-[9px] px-3.5 text-[12.5px] transition-colors',
                      on ? 'border-[1.5px] border-[#6366F1] bg-[#F0EFFE] font-bold text-[#3B4FE0]'
                         : 'border border-[#E2E6F0] bg-white font-semibold text-[#334155] hover:bg-[#F7F8FC]')}>
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {serverError && (
            <p role="alert" className="mt-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
              {serverError}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={onClose}
              className="h-11 rounded-[10px] border border-[#E2E6F0] bg-white px-6 text-[13.5px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex h-11 items-center gap-2 rounded-[10px] px-6 text-[13.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] transition-[filter] hover:brightness-105 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
              {saving && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Add New Location, and the same form in edit mode from the row menu.
 * The form is MOUNTED only while open so its state is fresh each time — no
 * reset effect, and a cancelled edit can never leak into the next "Add".
 */
export function LocationFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing?: ClinicLocationDto | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  if (!open) return null;
  return <LocationForm key={editing?.id ?? 'new'} editing={editing} onClose={onClose} onSaved={onSaved} />;
}
