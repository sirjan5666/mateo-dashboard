import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { FileSignature, Loader2, Search, X } from 'lucide-react';
import { listPatients } from '../../../api/doctorPatients';
import type { Patient } from '../../../api/doctorPatients';
import { IssuePrescriptionModal } from './IssuePrescriptionModal';

/**
 * A primary, always-visible "New Prescription" action (spec #20). Creating a
 * prescription needs a patient, so this opens a quick patient picker (search by
 * name / phone / ID) and then the full Issue Prescription editor for the chosen
 * patient — no need to first navigate into a patient's workspace.
 */
export function NewPrescriptionButton() {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!pickerOpen || patients.length) return undefined;
    let cancelled = false;
    // Deferred so no setState runs synchronously in the effect body
    // (react-hooks/set-state-in-effect is an error in this repo).
    const t = setTimeout(() => {
      setLoading(true);
      listPatients()
        .then((r) => { if (!cancelled) setPatients(r.patients); })
        .catch(() => { /* leave the list empty; the doctor can retry */ })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [pickerOpen, patients.length]);

  const filtered = patients.filter((p) => {
    const q = query.trim().toLowerCase();
    return !q || p.displayName.toLowerCase().includes(q) || (p.phone ?? '').includes(q) || (p.code ?? '').includes(q);
  }).slice(0, 40);

  return (
    <>
      <button type="button" onClick={() => setPickerOpen(true)}
        className="flex h-[42px] items-center gap-2 rounded-[11px] px-4 text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105"
        style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
        <FileSignature className="h-[17px] w-[17px]" />
        <span className="text-[13px] font-bold">New Prescription</span>
      </button>

      {pickerOpen && !picked && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.45)] p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={() => setPickerOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label="Choose a patient" className="relative w-full max-w-[440px] rounded-[16px] border border-[#ECEEF4] bg-white p-5 shadow-[0_24px_60px_-20px_rgba(15,23,42,.35)]">
            <div className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-[#3B4FE0]" />
              <h2 className="font-display text-[17px] font-extrabold tracking-[-0.02em] text-[#0F172A]">New prescription — choose a patient</h2>
              <button type="button" aria-label="Close" onClick={() => setPickerOpen(false)} className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-[#E2E6F0] text-[#64748B] hover:bg-[#F7F8FC]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative mt-3.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, phone or patient ID" autoComplete="off"
                className="h-11 w-full rounded-[10px] border border-[#E4E8F1] bg-white pl-9 pr-3.5 text-[13.5px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
            </div>
            <div className="mt-2.5 max-h-[340px] overflow-y-auto rounded-[10px] border border-[#EEF1F6]">
              {loading ? (
                <p className="flex items-center gap-2 px-3 py-3 text-[13px] text-[#94A3B8]"><Loader2 className="h-4 w-4 animate-spin" />Loading patients…</p>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-[13px] text-[#94A3B8]">No patients found.</p>
              ) : filtered.map((p) => (
                <button key={p.id} type="button" onClick={() => setPicked({ id: p.id, name: p.displayName })}
                  className="flex w-full items-center gap-3 border-b border-[#F4F6FB] px-3.5 py-2.5 text-left last:border-b-0 hover:bg-[#F7F8FC]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EEF2FF] text-[12px] font-bold text-[#3B4FE0]">
                    {p.displayName.trim().slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-[#0F172A]">{p.displayName}</span>
                    <span className="block truncate text-[12px] text-[#64748B]">{[p.code ? `#${p.code}` : null, p.phone].filter(Boolean).join(' · ') || '—'}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {picked && (
        <IssuePrescriptionModal patientId={picked.id} patientName={picked.name}
          onClose={() => { setPicked(null); setPickerOpen(false); }}
          onIssued={(docId) => { setPicked(null); setPickerOpen(false); navigate(`/doctor/prescriptions/${docId}`); }} />
      )}
    </>
  );
}
