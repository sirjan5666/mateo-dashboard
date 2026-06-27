import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { getMyDoctorProfile, saveMyDoctorProfile } from '../../api/doctors';
import { ApiError } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { inputCls } from '../../components/ui/field';
import { cn } from '../../lib/cn';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOT_OPTIONS = [15, 20, 30, 45, 60];

export default function DoctorProfileForm() {
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
          setCity(p.city ?? '');
          setDays(p.availability.days);
          setStartTime(p.availability.startTime);
          setEndTime(p.availability.endTime);
          setSlotMinutes(p.availability.slotMinutes);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fee = parseInt(consultationFee, 10);
    if (!specialization.trim()) {
      setError('Specialization is required');
      return;
    }
    if (Number.isNaN(fee) || fee < 0) {
      setError('Enter a valid consultation fee');
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
        city: city.trim() || undefined,
        availability: { days, startTime, endTime, slotMinutes },
      });
      navigate('/doctor');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/doctor" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <header className="mt-3">
        <p className="eyebrow">Doctor</p>
        <h1 className="text-2xl font-extrabold text-stone-900">{isNew ? 'Set up your profile' : 'Edit your profile'}</h1>
        <p className="mt-1 text-sm text-stone-500">This is what parents see when they look for a doctor.</p>
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
                <label htmlFor="spec" className="block text-sm font-medium text-stone-700">Specialization *</label>
                <input id="spec" value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Pediatrician" className={inputCls} />
              </div>
              <div>
                <label htmlFor="fee" className="block text-sm font-medium text-stone-700">Consultation fee (₹) *</label>
                <input id="fee" type="number" min="0" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} placeholder="500" className={inputCls} />
              </div>
              <div>
                <label htmlFor="quals" className="block text-sm font-medium text-stone-700">Qualifications</label>
                <input id="quals" value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="MBBS, MD (Pediatrics)" className={inputCls} />
              </div>
              <div>
                <label htmlFor="exp" className="block text-sm font-medium text-stone-700">Experience (years)</label>
                <input id="exp" type="number" min="0" max="80" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="reg" className="block text-sm font-medium text-stone-700">Medical registration no.</label>
                <input id="reg" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="langs" className="block text-sm font-medium text-stone-700">Languages</label>
                <input id="langs" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Hindi" className={inputCls} />
                <p className="mt-1 text-xs text-stone-500">Comma-separated</p>
              </div>
              <div>
                <label htmlFor="clinic" className="block text-sm font-medium text-stone-700">Clinic / hospital</label>
                <input id="clinic" value={clinicName} onChange={(e) => setClinicName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-stone-700">City</label>
                <input id="city" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-stone-700">About you</label>
              <textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short introduction parents will read." className={cn(inputCls, 'resize-none')} />
            </div>

            <div className="rounded-xl border border-stone-200 p-4">
              <h2 className="text-sm font-semibold text-stone-800">Availability</h2>
              <p className="mt-0.5 text-xs text-stone-500">When are you available for consultations?</p>
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
                  <label htmlFor="start" className="block text-xs text-stone-500">From</label>
                  <input id="start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="end" className="block text-xs text-stone-500">To</label>
                  <input id="end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="slot" className="block text-xs text-stone-500">Slot length</label>
                  <select id="slot" value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className={inputCls}>
                    {SLOT_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : isNew ? 'Submit for review' : 'Save changes'}
              </Button>
              <Link to="/doctor">
                <Button type="button" variant="secondary">Cancel</Button>
              </Link>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
