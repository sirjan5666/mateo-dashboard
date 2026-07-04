import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { getMyDoctorProfile, saveMyDoctorProfile, WEEK_DAYS } from '../../api/doctors';
import type { WorkingHours, DoctorNotifications, WeekDay, DayHours } from '../../api/doctors';
import { ApiError } from '../../api/client';
import { useT } from '../../i18n/context';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { inputCls } from '../../components/ui/field';
import { cn } from '../../lib/cn';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOT_OPTIONS = [15, 20, 30, 45, 60];

const DEFAULT_HOURS: WorkingHours = {
  monday: { start: '10:00', end: '17:00', closed: false },
  tuesday: { start: '10:00', end: '17:00', closed: false },
  wednesday: { start: '10:00', end: '17:00', closed: false },
  thursday: { start: '10:00', end: '17:00', closed: false },
  friday: { start: '10:00', end: '17:00', closed: false },
  saturday: { start: '10:00', end: '14:00', closed: false },
  sunday: { start: '10:00', end: '14:00', closed: true },
};

export default function DoctorProfileForm() {
  const t = useT();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [isNew, setIsNew] = useState(true);

  const [specialization, setSpecialization] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [city, setCity] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [clinicAddress, setClinicAddress] = useState('');
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_HOURS);
  const [bank, setBank] = useState({ accountHolder: '', accountNumber: '', ifsc: '', bankName: '' });
  const [notif, setNotif] = useState<DoctorNotifications>({ email: true, sms: false, reminders: true });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyDoctorProfile()
      .then((d) => {
        if (cancelled) return;
        if (d.profile) {
          const p = d.profile;
          setIsNew(false);
          setSpecialization(p.specialization);
          setQualifications(p.qualifications);
          setExperienceYears(String(p.experienceYears || ''));
          setRegistrationNo(p.registrationNo);
          setConsultationFee(String(p.consultationFee));
          setBio(p.bio);
          setLanguages(p.languages.join(', '));
          setClinicName(p.clinicName ?? '');
          setClinicAddress(p.clinicAddress ?? '');
          setCity(p.city ?? '');
          setDays(p.availability.days);
          setStartTime(p.availability.startTime);
          setEndTime(p.availability.endTime);
          setSlotMinutes(p.availability.slotMinutes);
          if (p.workingHours) setWorkingHours(p.workingHours);
          if (p.bankDetails) setBank(p.bankDetails);
          setNotif(p.notifications);
        }
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  }

  function setDay(day: WeekDay, partial: Partial<DayHours>) {
    setWorkingHours((prev) => ({ ...prev, [day]: { ...prev[day], ...partial } }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fee = parseInt(consultationFee, 10);
    if (!specialization.trim()) {
      setError(t('doctor.profile.errSpec'));
      return;
    }
    if (Number.isNaN(fee) || fee < 0) {
      setError(t('doctor.profile.errFee'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveMyDoctorProfile({
        specialization: specialization.trim(),
        qualifications: qualifications.trim(),
        experienceYears: experienceYears ? parseInt(experienceYears, 10) : 0,
        registrationNo: registrationNo.trim(),
        bio: bio.trim(),
        consultationFee: fee,
        languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
        clinicName: clinicName.trim() || undefined,
        clinicAddress: clinicAddress.trim() || undefined,
        city: city.trim() || undefined,
        availability: { days, startTime, endTime, slotMinutes },
        workingHours,
        notifications: notif,
        bankDetails:
          bank.accountHolder.trim() || bank.accountNumber.trim() || bank.ifsc.trim() || bank.bankName.trim()
            ? {
                accountHolder: bank.accountHolder.trim(),
                accountNumber: bank.accountNumber.trim(),
                ifsc: bank.ifsc.trim(),
                bankName: bank.bankName.trim(),
              }
            : undefined,
      });
      navigate('/doctor');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('doctor.profile.errGeneric'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/doctor" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        {t('doctor.profile.back')}
      </Link>
      <header className="mt-3">
        <p className="eyebrow">Doctor</p>
        <h1 className="text-2xl font-extrabold text-stone-900">{isNew ? t('doctor.profile.setupTitle') : t('doctor.profile.editTitle')}</h1>
        <p className="mt-1 text-sm text-stone-500">{t('doctor.profile.subtitle')}</p>
      </header>

      {!loaded ? (
        <Card className="mt-6 p-6">
          <Skeleton className="h-64 w-full" />
        </Card>
      ) : (
        <Card className="mt-6 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="spec" className="block text-sm font-medium text-stone-700">{t('doctor.profile.specialization')}</label>
                <input id="spec" value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder={t('doctor.profile.specPlaceholder')} className={inputCls} />
              </div>
              <div>
                <label htmlFor="fee" className="block text-sm font-medium text-stone-700">{t('doctor.profile.fee')}</label>
                <input id="fee" type="number" min="0" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} placeholder="500" className={cn(inputCls, 'tabular')} />
              </div>
              <div>
                <label htmlFor="quals" className="block text-sm font-medium text-stone-700">{t('doctor.profile.quals')}</label>
                <input id="quals" value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder={t('doctor.profile.qualsPlaceholder')} className={inputCls} />
              </div>
              <div>
                <label htmlFor="exp" className="block text-sm font-medium text-stone-700">{t('doctor.profile.experience')}</label>
                <input id="exp" type="number" min="0" max="80" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} className={cn(inputCls, 'tabular')} />
              </div>
              <div>
                <label htmlFor="reg" className="block text-sm font-medium text-stone-700">{t('doctor.profile.registration')}</label>
                <input id="reg" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="langs" className="block text-sm font-medium text-stone-700">{t('doctor.profile.languages')}</label>
                <input id="langs" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder={t('doctor.profile.languagesPlaceholder')} className={inputCls} />
                <p className="mt-1 text-xs text-stone-500">{t('doctor.profile.commaSep')}</p>
              </div>
              <div>
                <label htmlFor="clinic" className="block text-sm font-medium text-stone-700">{t('doctor.profile.clinic')}</label>
                <input id="clinic" value={clinicName} onChange={(e) => setClinicName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-stone-700">{t('doctor.profile.city')}</label>
                <input id="city" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label htmlFor="clinicAddress" className="block text-sm font-medium text-stone-700">Clinic address</label>
              <input id="clinicAddress" value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} placeholder="Street, area, city" className={inputCls} />
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-stone-700">{t('doctor.profile.about')}</label>
              <textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t('doctor.profile.aboutPlaceholder')} className={cn(inputCls, 'resize-none')} />
            </div>

            <div className="rounded-xl border border-stone-200 p-4">
              <h2 className="text-sm font-semibold text-stone-800">{t('doctor.profile.availability')}</h2>
              <p className="mt-0.5 text-xs text-stone-500">{t('doctor.profile.availabilityHint')}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {DAYS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(i)}
                    aria-pressed={days.includes(i)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      days.includes(i) ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="start" className="block text-xs text-stone-500">{t('doctor.profile.from')}</label>
                  <input id="start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="end" className="block text-xs text-stone-500">{t('doctor.profile.to')}</label>
                  <input id="end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="slot" className="block text-xs text-stone-500">{t('doctor.profile.slotLength')}</label>
                  <select id="slot" value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className={inputCls}>
                    {SLOT_OPTIONS.map((m) => (
                      <option key={m} value={m}>{t('doctor.profile.minSuffix', { n: m })}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Working hours — per-day clinic opening times (distinct from the booking window above) */}
            <div className="rounded-xl border border-stone-200 p-4">
              <h2 className="text-sm font-semibold text-stone-800">Working hours</h2>
              <p className="mt-0.5 text-xs text-stone-500">Your clinic opening hours, per day. (Online booking uses the availability window above.)</p>
              <div className="mt-3 space-y-2">
                {WEEK_DAYS.map((day) => {
                  const h = workingHours[day];
                  return (
                    <div key={day} className="flex flex-wrap items-center gap-2">
                      <span className="w-24 text-sm font-medium capitalize text-stone-700">{day}</span>
                      <label className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                        <input type="checkbox" checked={!h.closed} onChange={(e) => setDay(day, { closed: !e.target.checked })} className="h-4 w-4 rounded border-stone-300" />
                        Open
                      </label>
                      {h.closed ? (
                        <span className="text-xs font-medium text-stone-400">Closed</span>
                      ) : (
                        <>
                          <input type="time" value={h.start} onChange={(e) => setDay(day, { start: e.target.value })} className={cn(inputCls, 'w-32')} />
                          <span className="text-stone-400">–</span>
                          <input type="time" value={h.end} onChange={(e) => setDay(day, { end: e.target.value })} className={cn(inputCls, 'w-32')} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bank details — encrypted at rest; only the owner sees them */}
            <div className="rounded-xl border border-stone-200 p-4">
              <h2 className="text-sm font-semibold text-stone-800">Bank details</h2>
              <p className="mt-0.5 text-xs text-stone-500">For payouts from collections. Stored encrypted — only you can see it.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-stone-500">Account holder</label>
                  <input value={bank.accountHolder} onChange={(e) => setBank((b) => ({ ...b, accountHolder: e.target.value }))} className={inputCls} autoComplete="off" />
                </div>
                <div>
                  <label className="block text-xs text-stone-500">Account number</label>
                  <input value={bank.accountNumber} onChange={(e) => setBank((b) => ({ ...b, accountNumber: e.target.value }))} className={cn(inputCls, 'tabular')} autoComplete="off" />
                </div>
                <div>
                  <label className="block text-xs text-stone-500">IFSC code</label>
                  <input value={bank.ifsc} onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value.toUpperCase() }))} className={inputCls} autoComplete="off" />
                </div>
                <div>
                  <label className="block text-xs text-stone-500">Bank name</label>
                  <input value={bank.bankName} onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))} className={inputCls} autoComplete="off" />
                </div>
              </div>
            </div>

            {/* Notification preferences */}
            <div className="rounded-xl border border-stone-200 p-4">
              <h2 className="text-sm font-semibold text-stone-800">Notifications</h2>
              <div className="mt-3 space-y-2">
                {([
                  ['email', 'Email notifications'],
                  ['sms', 'SMS notifications'],
                  ['reminders', 'Appointment reminders'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2.5 text-sm text-stone-700">
                    <input type="checkbox" checked={notif[key]} onChange={(e) => setNotif((n) => ({ ...n, [key]: e.target.checked }))} className="h-4 w-4 rounded border-stone-300" />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? t('doctor.profile.saving') : isNew ? t('doctor.profile.submitReview') : t('doctor.profile.saveChanges')}
              </Button>
              <Link to="/doctor">
                <Button type="button" variant="secondary">{t('doctor.profile.cancel')}</Button>
              </Link>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
