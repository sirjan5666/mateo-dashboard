import { Printer } from 'lucide-react';
import type { Prescription } from '../api/prescriptions';
import { formatAge, formatDateIST } from '../lib/age';

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

// Build a clean, self-contained printable prescription (also "downloadable" via
// the browser's Save-as-PDF in the print dialog).
function buildHtml(rx: Prescription): string {
  const patient = rx.patient ? `${esc(rx.patient.name)} &middot; ${esc(formatAge(rx.patient.dob))} &middot; ${rx.patient.sex === 'female' ? 'Girl' : 'Boy'}` : '—';
  const rows = rx.items
    .map(
      (it, i) => `<tr>
      <td style="text-align:center;color:#888">${i + 1}</td>
      <td><strong>${esc(it.medicine)}</strong>${it.notes ? `<br><span style="color:#666;font-size:12px">${esc(it.notes)}</span>` : ''}</td>
      <td>${esc(it.dosage)}</td>
      <td>${esc(it.frequency)}</td>
      <td>${esc(it.duration)}</td>
    </tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Prescription — ${esc(rx.doctor.name)}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:36px;max-width:760px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2e7d6b;padding-bottom:12px}
  .doc h1{margin:0;font-size:22px;color:#16352b} .doc .q{color:#555;font-size:13px;margin-top:2px}
  .brand{color:#2e7d6b;font-weight:800;font-size:18px} .brand small{display:block;color:#888;font-weight:400;font-size:11px}
  .pt{display:flex;justify-content:space-between;font-size:13px;color:#444;margin:14px 0}
  .rx{font-size:30px;color:#2e7d6b;font-weight:700;margin:6px 0 2px}
  table{width:100%;border-collapse:collapse;font-size:13px} th{text-align:left;border-bottom:1px solid #ddd;padding:6px 8px;color:#666;font-size:11px;text-transform:uppercase}
  td{padding:8px;border-bottom:1px solid #f0f0f0;vertical-align:top}
  .sec{margin-top:16px;font-size:13px} .sec b{display:block;color:#666;font-size:11px;text-transform:uppercase;margin-bottom:3px}
  .sign{margin-top:46px;text-align:right;font-size:13px} .sign .line{display:inline-block;border-top:1px solid #333;padding-top:4px;min-width:200px}
  .foot{margin-top:24px;border-top:1px solid #eee;padding-top:10px;color:#999;font-size:11px;line-height:1.5}
</style></head><body>
  <div class="top">
    <div class="doc">
      <h1>Dr. ${esc(rx.doctor.name)}</h1>
      <div class="q">${esc([rx.doctor.qualifications, rx.doctor.specialization].filter(Boolean).join(' · '))}</div>
      ${rx.doctor.registrationNo ? `<div class="q">Reg. No: ${esc(rx.doctor.registrationNo)}</div>` : ''}
      ${rx.doctor.clinicName ? `<div class="q">${esc(rx.doctor.clinicName)}</div>` : ''}
    </div>
    <div class="brand">mateo<small>care.com</small></div>
  </div>
  <div class="pt"><span><b>Patient:</b> ${patient}</span><span>${esc(formatDateIST(rx.createdAt))}</span></div>
  ${rx.diagnosis ? `<div class="sec"><b>Diagnosis</b>${esc(rx.diagnosis)}</div>` : ''}
  <div class="rx">&#8478;</div>
  <table><thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead><tbody>${rows}</tbody></table>
  ${rx.advice ? `<div class="sec"><b>Advice</b>${esc(rx.advice)}</div>` : ''}
  ${rx.followUpDate ? `<div class="sec"><b>Follow-up</b>${esc(formatDateIST(rx.followUpDate))}</div>` : ''}
  <div class="sign"><span class="line">Dr. ${esc(rx.doctor.name)}</span></div>
  <div class="foot">This prescription is issued by the named doctor. Mateo provides the platform and is not responsible for the medical advice. Please follow your doctor's guidance and consult them for any concerns.</div>
</body></html>`;
}

function printPrescription(rx: Prescription): void {
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) return;
  w.document.write(buildHtml(rx));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export function PrescriptionCard({ rx }: { rx: Prescription }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
        <div>
          <p className="font-bold text-stone-900">Dr. {rx.doctor.name}</p>
          <p className="text-xs text-stone-500">{[rx.doctor.qualifications, rx.doctor.specialization].filter(Boolean).join(' · ')}</p>
          {rx.doctor.registrationNo && <p className="text-xs text-stone-400">Reg. No: {rx.doctor.registrationNo}</p>}
        </div>
        <button
          type="button"
          onClick={() => printPrescription(rx)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          <Printer className="h-4 w-4" />
          Print / PDF
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs text-stone-500">
        <span>{rx.patient ? `${rx.patient.name} · ${formatAge(rx.patient.dob)}` : 'Patient'}</span>
        <span>{formatDateIST(rx.createdAt)}</span>
      </div>

      {rx.diagnosis && (
        <p className="mt-3 text-sm text-stone-700"><span className="font-semibold text-stone-500">Diagnosis: </span>{rx.diagnosis}</p>
      )}

      <div className="mt-3">
        <span className="text-2xl font-bold text-emerald-700">℞</span>
        <ul className="mt-1 divide-y divide-stone-100">
          {rx.items.map((it, i) => (
            <li key={i} className="py-2 text-sm">
              <p className="font-semibold text-stone-800">{i + 1}. {it.medicine}</p>
              <p className="text-xs text-stone-500">
                {[it.dosage, it.frequency, it.duration].filter(Boolean).join(' · ')}
                {it.notes && <span className="block">{it.notes}</span>}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {rx.advice && <p className="mt-3 text-sm text-stone-700"><span className="font-semibold text-stone-500">Advice: </span>{rx.advice}</p>}
      {rx.followUpDate && <p className="mt-1 text-sm text-stone-700"><span className="font-semibold text-stone-500">Follow-up: </span>{formatDateIST(rx.followUpDate)}</p>}
    </div>
  );
}
