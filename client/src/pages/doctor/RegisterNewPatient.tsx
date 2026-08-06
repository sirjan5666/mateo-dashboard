import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { createPatient, getPatient, listTemplates, updatePatient } from '../../api/doctorPatients';
import { useActiveLocation } from '../../lib/doctorLocation';
import { ArrowLeft, Building2, Calendar, ChevronDown, Info, Loader2, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { BLOOD_GROUPS, DELIVERY_TYPES, MARITAL_STATUSES, RELATIONSHIPS, STATES } from '../../data/geo';
import { FieldError, INPUT, INPUT_ERR, Label, PhoneNumberInput } from '../../components/doctor/v2/subuser/fields';
import { cn } from '../../lib/cn';

const CARD =
  'rounded-[14px] border border-[#ECEEF4] bg-white px-[22px] pb-6 pt-5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const TITLE = 'font-display text-base font-bold tracking-[-0.01em] text-[#0F172A]';
const SELECT = cn(INPUT, 'appearance-none pr-10');
const TEXTAREA =
  'min-h-[62px] w-full rounded-[10px] border border-[#E4E8F1] bg-white px-3.5 py-3 text-[13.5px] font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,79,224,.12)]';

function Select({ id, value, onChange, placeholder, options, error }: {
  id: string; value: string; onChange: (v: string) => void; placeholder: string; options: string[]; error?: boolean;
}) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(SELECT, !value && 'text-[#94A3B8]', error && INPUT_ERR)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#94A3B8]" />
    </div>
  );
}

function Checkbox({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="mt-4 flex cursor-pointer items-center gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded-[5px] border-[1.5px] border-[#C7CEDB] accent-[#4F63F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
      />
      <span className="text-[13px] font-medium text-[#334155]">{children}</span>
    </label>
  );
}

interface Errors { [k: string]: string | undefined }

const GENDER_OF = { male: 'Male', female: 'Female', other: 'Other', unspecified: 'Male' } as Record<string, string>;
const SEX_OF = { Male: 'male', Female: 'female', Other: 'other' } as Record<string, string>;

/**
 * Registers a NEW patient, and — with `?edit=<id>` — re-opens the same form
 * filled in so it can be corrected. Deliberately the same form: a separate
 * "edit patient" screen would be a second place for these fields to drift.
 */
export default function RegisterNewPatient() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const editId = search.get('edit');
  const [loading, setLoading] = useState(!!editId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { clinics } = useActiveLocation();
  const [pickedLocation, setPickedLocation] = useState('');
  // Defaults to the doctor's primary clinic until they choose another.
  const locationId = pickedLocation || clinics.find((c) => c.primary)?.id || clinics[0]?.id || '';
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [f, setF] = useState({
    fullName: '', dob: '', gender: 'Male', bloodGroup: '', maritalStatus: '',
    birthWeight: '', birthHeight: '', deliveryType: '', gestationalAge: '',
    guardianName: '', guardianRelationship: '', guardianPhone: '', guardianEmail: '', sameAsPermanent: false,
    phone: '', whatsapp: false, email: '', address1: '', address2: '', city: '', state: '', pincode: '',
    emergencyName: '', emergencyRelationship: '', emergencyPhone: '', sameAsGuardian: false,
    allergies: '', chronic: '', medications: '', notes: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  // Load the existing record into the shape the form already uses.
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { patient } = await getPatient(editId);
        if (cancelled) return;
        setF((prev) => ({
          ...prev,
          fullName: patient.displayName ?? '',
          dob: patient.dob ?? '',
          gender: GENDER_OF[patient.sex] ?? 'Male',
          bloodGroup: patient.bloodGroup ?? '',
          birthWeight: patient.birthWeightKg != null ? String(patient.birthWeightKg) : '',
          birthHeight: patient.birthHeightCm != null ? String(patient.birthHeightCm) : '',
          deliveryType: patient.deliveryType ?? '',
          gestationalAge: patient.gestationalAgeWeeks != null ? String(patient.gestationalAgeWeeks) : '',
          guardianName: patient.guardianName ?? '',
          guardianRelationship: patient.guardianRelationship ?? '',
          guardianPhone: patient.guardianPhone ?? '',
          guardianEmail: patient.guardianEmail ?? '',
          phone: patient.phone ?? '',
          email: patient.email ?? '',
          address1: patient.address ?? '',
          address2: patient.addressLine2 ?? '',
          city: patient.city ?? '',
          state: patient.state ?? '',
          pincode: patient.pincode ?? '',
          emergencyName: patient.emergencyName ?? '',
          emergencyRelationship: patient.emergencyRelationship ?? '',
          emergencyPhone: patient.emergencyPhone ?? '',
        }));
        if (patient.locationId) setPickedLocation(patient.locationId);
      } catch (e: unknown) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load this patient');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const cities = useMemo(() => STATES.find((s) => s.name === f.state)?.cities ?? [], [f.state]);

  function validate(): Errors {
    const e: Errors = {};
    const phone10 = (v: string) => v.replace(/\D/g, '').length === 10;
    if (f.fullName.trim().length < 2) e.fullName = 'Enter the child’s full name.';
    if (!f.dob) e.dob = 'Date of birth is required.';
    else if (new Date(f.dob) > new Date()) e.dob = 'Date of birth cannot be in the future.';
    if (f.guardianName.trim().length < 2) e.guardianName = 'Enter the guardian’s name.';
    if (!f.guardianRelationship) e.guardianRelationship = 'Select a relationship.';
    if (!phone10(f.guardianPhone)) e.guardianPhone = 'Enter a 10-digit mobile number.';
    if (!phone10(f.phone)) e.phone = 'Enter a 10-digit mobile number.';
    if (!f.address1.trim()) e.address1 = 'Address is required.';
    if (!f.state) e.state = 'Select a state.';
    if (!f.city) e.city = 'Select a city.';
    if (!/^\d{6}$/.test(f.pincode)) e.pincode = 'Enter a 6-digit pincode.';
    if (f.emergencyName.trim().length < 2) e.emergencyName = 'Enter a contact name.';
    if (!f.emergencyRelationship) e.emergencyRelationship = 'Select a relationship.';
    if (!phone10(f.emergencyPhone)) e.emergencyPhone = 'Enter a 10-digit mobile number.';
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter a valid email address.';
    if (f.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.guardianEmail)) e.guardianEmail = 'Enter a valid email address.';
    return e;
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      const el = formRef.current?.querySelector<HTMLElement>(`#${first}`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    void (async () => {
      setSaving(true);
      setSubmitError(null);
      try {
        const num = (v: string) => (v.trim() ? Number(v) : undefined);
        // EVERY field the form asks for is sent. Previously twenty-odd were
        // collected and five stored, so re-opening a patient showed blanks.
        const demographics = {
          bloodGroup: f.bloodGroup || undefined,
          birthWeightKg: num(f.birthWeight),
          birthHeightCm: num(f.birthHeight),
          deliveryType: f.deliveryType || undefined,
          gestationalAgeWeeks: num(f.gestationalAge),
          guardianName: f.guardianName.trim() || undefined,
          guardianRelationship: f.guardianRelationship || undefined,
          guardianPhone: f.guardianPhone.trim() || undefined,
          guardianEmail: f.guardianEmail.trim() || undefined,
          email: f.email.trim() || undefined,
          address: f.address1.trim() || undefined,
          addressLine2: f.address2.trim() || undefined,
          city: f.city || undefined,
          state: f.state || undefined,
          pincode: f.pincode.trim() || undefined,
          emergencyName: f.emergencyName.trim() || undefined,
          emergencyRelationship: f.emergencyRelationship || undefined,
          emergencyPhone: f.emergencyPhone.trim() || undefined,
        };
        const core = {
          displayName: f.fullName.trim(),
          dob: f.dob,
          sex: SEX_OF[f.gender] ?? 'unspecified',
          phone: f.phone.trim() || undefined,
          // Attributes the patient to the clinic they walked into, which is what
          // makes the per-location counts on the Locations page real.
          locationId: locationId || undefined,
        };

        if (editId) {
          await updatePatient(editId, { ...core, ...demographics });
          navigate(`/doctor/patients/${editId}`);
          return;
        }

        const { templates } = await listTemplates();
        const template = templates[0];
        if (!template) {
          setSubmitError('No specialty template exists yet — one is needed before patients can be registered.');
          setSaving(false);
          return;
        }
        await createPatient({ templateId: template.id, ...core, ...demographics });
        // Uploaded documents are held client-side only — the workspace Documents
        // tab is where they belong, so they are not claimed as saved here.
        navigate('/doctor/patients');
      } catch (err) {
        const fallback = editId ? 'Could not save this patient' : 'Could not register this patient';
        setSubmitError(err instanceof Error ? err.message : fallback);
        setSaving(false);
      }
    })();
  }

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((p) => [...p, ...[...list].filter((x) => x.size <= 5 * 1024 * 1024)]);
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-[#64748B]">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading patient…
      </p>
    );
  }

  // An edit that could not load must not fall through to a blank form — saving
  // it would wipe the record it was meant to correct.
  if (loadError) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-lg font-bold text-[#0F172A]">Patient not found</h1>
        <p className="mt-2 text-sm text-[#64748B]">{loadError}</p>
        <button type="button" onClick={() => navigate('/doctor/patients')}
          className="mx-auto mt-5 h-11 rounded-[10px] border border-[#E2E6F0] bg-white px-5 text-[13.5px] font-bold text-[#1E2A5A]">
          Back to Patients
        </button>
      </div>
    );
  }

  return (
    <form id="register-patient" ref={formRef} onSubmit={onSubmit} noValidate>
      {/* Back */}
      <button type="button" onClick={() => navigate('/doctor/patients')} className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-[#3B4FE0] hover:underline">
        <ArrowLeft className="h-[17px] w-[17px]" />
        Back
      </button>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[15px]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]" style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
              <Building2 className="h-[21px] w-[21px] text-white" />
            </span>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">{editId ? 'Edit Patient' : 'Register New Patient'}</h1>
          </div>
          <p className="mt-[7px] text-sm text-[#64748B] sm:pl-[55px]">{editId ? 'Update this patient\u2019s details.' : 'Enter patient details to create a new patient record.'}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <button type="button" onClick={() => navigate('/doctor/patients')} className="h-12 flex-1 rounded-[11px] border border-[#E2E6F0] bg-white px-[34px] text-[14.5px] font-bold text-[#1E2A5A] transition-colors hover:bg-[#F7F8FC] sm:flex-none">
            Cancel
          </button>
          {clinics.length > 0 && (
            <span className="flex items-center gap-2">
              <label htmlFor="reg-location" className="text-[12.5px] font-bold text-[#334155]">Clinic</label>
              <select id="reg-location" value={locationId} onChange={(e) => setPickedLocation(e.target.value)}
                className="h-12 rounded-[11px] border border-[#E4E8F1] bg-white px-3.5 text-[13.5px] font-semibold text-[#334155] focus:border-[#3B4FE0] focus:outline-none">
                {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </span>
          )}
          <button type="submit" disabled={saving} className="h-12 flex-1 rounded-[11px] px-7 text-[14.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] transition-[filter] hover:brightness-105 disabled:opacity-60 sm:flex-none" style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
            {saving ? 'Saving…' : editId ? 'Save changes' : 'Save & Continue'}
          </button>
        </div>
      </div>

      {submitError && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
          {submitError}
        </p>
      )}

      {/* Columns */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {/* ── Column 1 ── */}
        <div className="flex flex-col gap-5">
          <section className={CARD}>
            <h2 className={TITLE}>Patient Information</h2>
            <div className="mt-[18px] grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="fullName" required>Full Name</Label>
                <input id="fullName" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Enter full name" aria-required="true" aria-invalid={errors.fullName ? true : undefined} className={cn(INPUT, errors.fullName && INPUT_ERR)} />
                <FieldError id="fullName-error" message={errors.fullName} />
              </div>
              <div>
                <Label htmlFor="patientId">Patient ID</Label>
                <input id="patientId" disabled placeholder="Auto-generated" aria-describedby="pid-note" className={cn(INPUT, 'cursor-not-allowed bg-[#F4F6FA]')} />
              </div>
              <div>
                <Label htmlFor="dob" required>Date of Birth</Label>
                <div className="relative">
                  <Calendar aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#64748B]" />
                  <input id="dob" type="date" value={f.dob} onChange={(e) => set('dob', e.target.value)} aria-required="true" aria-invalid={errors.dob ? true : undefined} className={cn(INPUT, 'pl-[42px]', errors.dob && INPUT_ERR)} />
                </div>
                <FieldError id="dob-error" message={errors.dob} />
              </div>
              <div>
                <fieldset>
                  <legend className="mb-2 block text-[13px] font-bold text-[#334155]">
                    Gender<span aria-hidden="true" className="ml-1 text-[#EF4444]">*</span>
                  </legend>
                  <div role="radiogroup" aria-label="Gender" className="grid grid-cols-3">
                    {['Male', 'Female', 'Other'].map((g, i) => (
                      <button
                        key={g} role="radio" type="button" aria-checked={f.gender === g} onClick={() => set('gender', g)}
                        className={cn(
                          'h-[46px] border text-[13.5px] transition-colors',
                          i === 0 && 'rounded-l-[10px]', i === 2 && 'rounded-r-[10px]', i === 1 && '-mx-px',
                          f.gender === g ? 'z-10 border-[1.5px] border-[#6366F1] bg-[#F0EFFE] font-bold text-[#3B4FE0]' : 'border-[#E4E8F1] bg-white font-semibold text-[#334155] hover:bg-[#F7F8FC]',
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div>
                <Label htmlFor="bloodGroup">Blood Group</Label>
                <Select id="bloodGroup" value={f.bloodGroup} onChange={(v) => set('bloodGroup', v)} placeholder="Select blood group" options={BLOOD_GROUPS} />
              </div>
              <div>
                <Label htmlFor="maritalStatus">Marital Status</Label>
                <Select id="maritalStatus" value={f.maritalStatus} onChange={(v) => set('maritalStatus', v)} placeholder="Select status" options={MARITAL_STATUSES} />
              </div>
            </div>
          </section>

          <section className={CARD}>
            <h2 className={TITLE}>Birth Details (For Children)</h2>
            <div className="mt-[18px] grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="birthWeight">Birth Weight</Label>
                <input id="birthWeight" value={f.birthWeight} onChange={(e) => set('birthWeight', e.target.value)} placeholder="e.g. 3.2 kg" className={INPUT} />
              </div>
              <div>
                <Label htmlFor="birthHeight">Birth Height</Label>
                <input id="birthHeight" value={f.birthHeight} onChange={(e) => set('birthHeight', e.target.value)} placeholder="e.g. 50 cm" className={INPUT} />
              </div>
              <div>
                <Label htmlFor="deliveryType">Delivery Type</Label>
                <Select id="deliveryType" value={f.deliveryType} onChange={(v) => set('deliveryType', v)} placeholder="Select type" options={DELIVERY_TYPES} />
              </div>
              <div className="sm:col-span-3">
                <Label htmlFor="gestationalAge">Gestational Age</Label>
                <input id="gestationalAge" value={f.gestationalAge} onChange={(e) => set('gestationalAge', e.target.value)} placeholder="e.g. 40 weeks" className={INPUT} />
              </div>
            </div>
          </section>

          <section className={CARD}>
            <h2 className={TITLE}>Primary Guardian / Parent</h2>
            <div className="mt-[18px] grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="guardianName" required>Name</Label>
                <input id="guardianName" value={f.guardianName} onChange={(e) => set('guardianName', e.target.value)} placeholder="Enter guardian name" aria-required="true" aria-invalid={errors.guardianName ? true : undefined} className={cn(INPUT, errors.guardianName && INPUT_ERR)} />
                <FieldError id="guardianName-error" message={errors.guardianName} />
              </div>
              <div>
                <Label htmlFor="guardianRelationship" required>Relationship</Label>
                <Select id="guardianRelationship" value={f.guardianRelationship} onChange={(v) => set('guardianRelationship', v)} placeholder="Select relationship" options={RELATIONSHIPS} error={!!errors.guardianRelationship} />
                <FieldError id="guardianRelationship-error" message={errors.guardianRelationship} />
              </div>
              <div>
                <Label htmlFor="guardianPhone" required>Phone Number</Label>
                <PhoneNumberInput value={f.guardianPhone} onChange={(v) => set('guardianPhone', v)} error={!!errors.guardianPhone} />
                <FieldError id="guardianPhone-error" message={errors.guardianPhone} />
              </div>
              <div>
                <Label htmlFor="guardianEmail">Email</Label>
                <input id="guardianEmail" type="email" value={f.guardianEmail} onChange={(e) => set('guardianEmail', e.target.value)} placeholder="Enter email address" className={cn(INPUT, errors.guardianEmail && INPUT_ERR)} />
                <FieldError id="guardianEmail-error" message={errors.guardianEmail} />
              </div>
            </div>
            <Checkbox id="sameAsPermanent" checked={f.sameAsPermanent} onChange={(v) => set('sameAsPermanent', v)}>Same as permanent address</Checkbox>
          </section>
        </div>

        {/* ── Column 2 ── */}
        <div className="flex flex-col gap-5">
          <section className={CARD}>
            <h2 className={TITLE}>Contact &amp; Address</h2>
            <div className="mt-[18px] grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="phone" required>Phone Number</Label>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1"><PhoneNumberInput value={f.phone} onChange={(v) => set('phone', v)} error={!!errors.phone} /></div>
                  <button
                    type="button" aria-label="Same number is on WhatsApp" aria-pressed={f.whatsapp} onClick={() => set('whatsapp', !f.whatsapp)}
                    className={cn('grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[9px] transition-colors', f.whatsapp ? 'bg-[#25D366]' : 'bg-[#DCF7E6]')}
                  >
                    <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill={f.whatsapp ? '#FFFFFF' : '#25D366'} aria-hidden="true">
                      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.22-8.24 8.22z" />
                    </svg>
                  </button>
                </div>
                <FieldError id="phone-error" message={errors.phone} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="email">Email Address</Label>
                <input id="email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="Enter email address" className={cn(INPUT, errors.email && INPUT_ERR)} />
                <FieldError id="email-error" message={errors.email} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address1" required>Address Line 1</Label>
                <input id="address1" value={f.address1} onChange={(e) => set('address1', e.target.value)} placeholder="House / Building / Street" aria-required="true" aria-invalid={errors.address1 ? true : undefined} className={cn(INPUT, errors.address1 && INPUT_ERR)} />
                <FieldError id="address1-error" message={errors.address1} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address2">Address Line 2</Label>
                <input id="address2" value={f.address2} onChange={(e) => set('address2', e.target.value)} placeholder="Area / Locality (Optional)" className={INPUT} />
              </div>
              <div>
                <Label htmlFor="city" required>City</Label>
                <Select id="city" value={f.city} onChange={(v) => set('city', v)} placeholder="Select city" options={cities} error={!!errors.city} />
                <FieldError id="city-error" message={errors.city} />
              </div>
              <div>
                <Label htmlFor="state" required>State</Label>
                <Select id="state" value={f.state} onChange={(v) => { set('state', v); set('city', ''); }} placeholder="Select state" options={STATES.map((s) => s.name)} error={!!errors.state} />
                <FieldError id="state-error" message={errors.state} />
              </div>
              <div>
                <Label htmlFor="pincode" required>Pincode</Label>
                <input id="pincode" inputMode="numeric" value={f.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter pincode" aria-required="true" aria-invalid={errors.pincode ? true : undefined} className={cn(INPUT, errors.pincode && INPUT_ERR)} />
                <FieldError id="pincode-error" message={errors.pincode} />
              </div>
            </div>
          </section>

          <section className={CARD}>
            <h2 className={TITLE}>Emergency Contact</h2>
            <div className="mt-[18px] grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="emergencyName" required>Contact Name</Label>
                <input id="emergencyName" value={f.emergencyName} onChange={(e) => set('emergencyName', e.target.value)} placeholder="Enter contact name" readOnly={f.sameAsGuardian} aria-required="true" aria-invalid={errors.emergencyName ? true : undefined} className={cn(INPUT, f.sameAsGuardian && 'bg-[#F4F6FA]', errors.emergencyName && INPUT_ERR)} />
                <FieldError id="emergencyName-error" message={errors.emergencyName} />
              </div>
              <div>
                <Label htmlFor="emergencyRelationship" required>Relationship</Label>
                <Select id="emergencyRelationship" value={f.emergencyRelationship} onChange={(v) => set('emergencyRelationship', v)} placeholder="Select relationship" options={RELATIONSHIPS} error={!!errors.emergencyRelationship} />
                <FieldError id="emergencyRelationship-error" message={errors.emergencyRelationship} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="emergencyPhone" required>Phone Number</Label>
                <PhoneNumberInput value={f.emergencyPhone} onChange={(v) => set('emergencyPhone', v)} error={!!errors.emergencyPhone} />
                <FieldError id="emergencyPhone-error" message={errors.emergencyPhone} />
              </div>
            </div>
            <Checkbox
              id="sameAsGuardian"
              checked={f.sameAsGuardian}
              onChange={(v) => {
                set('sameAsGuardian', v);
                if (v) setF((p) => ({ ...p, emergencyName: p.guardianName, emergencyRelationship: p.guardianRelationship, emergencyPhone: p.guardianPhone }));
              }}
            >
              Same as guardian contact
            </Checkbox>
          </section>
        </div>

        {/* ── Column 3 ── */}
        <div className="flex flex-col gap-5 lg:col-span-2 xl:col-span-1">
          <section className={CARD}>
            <h2 className={TITLE}>Medical Information</h2>
            <div className="mt-[18px] flex flex-col gap-4">
              {([
                ['allergies', 'Known Allergies', 'Enter known allergies (if any)'],
                ['chronic', 'Chronic Conditions', 'Enter chronic conditions (if any)'],
                ['medications', 'Regular Medications', 'Enter regular medications (if any)'],
                ['notes', 'Notes', 'Additional notes (optional)'],
              ] as const).map(([k, label, ph]) => (
                <div key={k}>
                  <Label htmlFor={k}>{label}</Label>
                  <textarea id={k} value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} className={TEXTAREA} />
                </div>
              ))}
            </div>

            <div id="pid-note" className="mt-5 flex items-start gap-3 rounded-[11px] border border-[#D5E3FC] bg-[#E9F0FE] px-4 py-3.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#2563EB]">
                <Info className="h-3 w-3 text-white" />
              </span>
              <div>
                <p className="text-[13px] font-bold text-[#1E3A8A]">Patient ID will be generated automatically</p>
                <p className="mt-[3px] text-xs text-[#3B5BA9]">A unique Patient ID will be created after saving the details.</p>
              </div>
            </div>
          </section>

          <section className={CARD}>
            <h2 className={TITLE}>Upload Documents</h2>
            <p className="mt-[5px] text-[12.5px] font-medium text-[#3B4FE0]">Upload any relevant documents (Optional)</p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              aria-label="Upload documents"
              className={cn(
                'mt-3.5 flex h-[168px] flex-col items-center justify-center rounded-[12px] border-[1.5px] border-dashed transition-colors',
                dragging ? 'border-[#3B4FE0] bg-[#F5F7FF]' : 'border-[#C7CEDB] bg-white',
              )}
            >
              <UploadCloud className="h-[34px] w-[34px] text-[#6D5AE0]" />
              <p className="mt-3 text-[13px] font-medium text-[#64748B]">Drag &amp; drop files here or</p>
              <button type="button" onClick={() => fileRef.current?.click()} className="mt-3 h-10 rounded-[9px] border border-[#DDE3F5] bg-white px-5 text-[13.5px] font-bold text-[#3B4FE0] transition-colors hover:bg-[#F5F7FF]">
                Choose Files
              </button>
              <input ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.pdf" className="sr-only" onChange={(e) => addFiles(e.target.files)} />
            </div>
            <p className="mt-[11px] text-[11.5px] text-[#94A3B8]">Supported: JPG, PNG, PDF (Max. 5MB each)</p>

            {files.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {files.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-[8px] bg-[#F1F3F9] px-2.5 py-1.5 text-[12px] font-medium text-[#334155]">
                    {file.name} <span className="text-[#94A3B8]">{Math.round(file.size / 1024)} KB</span>
                    <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                      <X className="h-3.5 w-3.5 text-[#64748B]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Privacy bar */}
      <div className="mt-5 flex items-center gap-3.5 rounded-[12px] border border-[#CFF0DC] bg-[#E9F8EF] px-5 py-4">
        <ShieldCheck className="h-[22px] w-[22px] shrink-0 text-[#12A150]" />
        <p className="text-[13.5px] font-medium text-[#166534]">
          All patient information is secure and confidential. By saving, you agree to our{' '}
          <a href="/privacy" className="font-bold hover:underline">privacy policy</a>.
        </p>
      </div>

      <p aria-live="polite" className="sr-only">
        {Object.keys(errors).length ? `${Object.keys(errors).length} fields need attention.` : ''}
      </p>
    </form>
  );
}
