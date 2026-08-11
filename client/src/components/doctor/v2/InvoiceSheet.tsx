import { Globe, Mail, MapPin, Phone } from 'lucide-react';
import type { InvoiceBillingPatient, InvoiceFull } from '../../../api/doctorBilling';
import type { WorkingHours } from '../../../api/doctors';
import { WEEK_DAYS } from '../../../api/doctors';

/**
 * The printable clinic invoice (spec image). Its root carries id="rx-sheet" so it
 * reuses the shared A4 print scaffolding in index.css unchanged — zero page
 * margin (no browser header/URL), fit-to-one-page scaling, background retention.
 *
 * Every value is real or omitted. The doctor invoice models a line as
 * {description, amount}; there is no per-line quantity, tax rate, payment mode or
 * transaction id, and medical invoices here carry no GST split — so those lines
 * are shown only when there is a genuine value, never a fabricated CGST/SGST or a
 * made-up UPI reference. This is a document a patient keeps for reimbursement.
 */

const NAVY = '#1E3A6E';
const money = (n: number) => `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function longDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Whole years + months from a DOB against today — ages are computed, never stored. */
function ageLabel(dob: string | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  const y = years > 0 ? `${years} Year${years === 1 ? '' : 's'}` : '';
  const m = `${months} Month${months === 1 ? '' : 's'}`;
  return [y, m].filter(Boolean).join(' ');
}

const SEX_LABEL: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other', unspecified: '' };

const H12 = (h: number) => (h % 12 === 0 ? 12 : h % 12);
const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${String(H12(h)).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/**
 * Collapse the seven-day working hours into the two or three lines a footer
 * shows — consecutive days that share the same hours are grouped, closed days
 * called out. Real data from Settings; omitted entirely when there are no hours.
 */
function timingLines(hours: WorkingHours | null): { days: string; time: string }[] {
  if (!hours) return [];
  const ABBR: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
  };
  const out: { days: string; time: string }[] = [];
  let runStart = 0;
  const key = (i: number) => {
    const d = hours[WEEK_DAYS[i]];
    return d.closed ? 'closed' : `${d.start}-${d.end}`;
  };
  for (let i = 1; i <= WEEK_DAYS.length; i += 1) {
    if (i === WEEK_DAYS.length || key(i) !== key(runStart)) {
      const d = hours[WEEK_DAYS[runStart]];
      const days = runStart === i - 1 ? ABBR[WEEK_DAYS[runStart]] : `${ABBR[WEEK_DAYS[runStart]]} – ${ABBR[WEEK_DAYS[i - 1]]}`;
      out.push({ days, time: d.closed ? 'Closed' : `${clock(d.start)} – ${clock(d.end)}` });
      runStart = i;
    }
  }
  return out;
}

export interface InvoiceClinic {
  name: string;
  addressLines: string[];
  phone: string;
  email: string;
  website: string;
  gstin: string;
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex gap-2 text-[11px] leading-[1.5]">
      <span className="w-[86px] shrink-0 font-semibold text-[#475569]">{label}</span>
      <span className="shrink-0 text-[#94A3B8]">:</span>
      <span className={accent ? 'font-bold text-[#0F172A]' : 'font-semibold text-[#0F172A]'} style={accent ? { color: NAVY } : undefined}>{value}</span>
    </div>
  );
}

export function InvoiceSheet({
  invoice,
  patient,
  clinic,
  doctorName,
  hours,
}: {
  invoice: InvoiceFull;
  patient: InvoiceBillingPatient | null;
  clinic: InvoiceClinic;
  doctorName: string;
  hours: WorkingHours | null;
}) {
  const subtotal = invoice.items.reduce((s, i) => s + i.amount, 0);
  const paid = invoice.amountPaid;
  const balance = Math.max(0, invoice.total - paid);
  const statusLabel = invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1);
  const age = ageLabel(patient?.dob ?? null);
  const sex = patient ? SEX_LABEL[patient.sex] ?? '' : '';
  const ageGender = [age, sex].filter(Boolean).join(' / ');
  const timings = timingLines(hours);

  return (
    <div id="rx-sheet" className="mx-auto w-full max-w-[820px] bg-white px-9 pb-8 pt-8 text-[#0F172A]" style={{ border: '1px solid #E6EAF2' }}>
      {/* ── Letterhead ── */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[13px] text-[26px] font-black text-white"
            style={{ background: `linear-gradient(135deg, #2F6FEB 0%, ${NAVY} 100%)` }}>
            M
          </span>
          <div>
            <p className="font-display text-[22px] font-extrabold leading-none tracking-[-0.01em]" style={{ color: NAVY }}>Mateo</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#2F6FEB]">Child Care Clinic</p>
            <p className="mt-1.5 text-[10.5px] font-medium italic text-[#64748B]">Caring for Little Lives</p>
          </div>
        </div>

        <div className="min-w-0 space-y-[5px] text-[10.5px] font-medium text-[#475569]">
          {clinic.addressLines.length > 0 && (
            <p className="flex items-start gap-1.5"><MapPin className="mt-[1px] h-3 w-3 shrink-0" style={{ color: NAVY }} />{clinic.addressLines.join(', ')}</p>
          )}
          {clinic.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" style={{ color: NAVY }} />{clinic.phone}</p>}
          {clinic.email && <p className="flex items-center gap-1.5"><Mail className="h-3 w-3 shrink-0" style={{ color: NAVY }} />{clinic.email}</p>}
          {clinic.website && <p className="flex items-center gap-1.5"><Globe className="h-3 w-3 shrink-0" style={{ color: NAVY }} />{clinic.website}</p>}
        </div>

        <div className="shrink-0 text-right">
          <p className="font-display text-[30px] font-black leading-none tracking-[-0.02em]" style={{ color: NAVY }}>INVOICE</p>
          <p className="mt-2 inline-block rounded-[6px] px-3 py-1 text-[12px] font-bold text-white" style={{ background: NAVY }}>{invoice.number}</p>
          <dl className="mt-3 space-y-[3px] text-[10.5px]">
            <div className="flex justify-end gap-2"><dt className="font-semibold text-[#475569]">Invoice Date</dt><dd className="w-[78px] text-left font-bold text-[#0F172A]">: {longDate(invoice.date)}</dd></div>
            <div className="flex justify-end gap-2">
              <dt className="font-semibold text-[#475569]">Payment Status</dt>
              <dd className="w-[78px] text-left font-bold" style={{ color: invoice.status === 'paid' ? '#12A150' : invoice.status === 'cancelled' ? '#E03131' : '#E8890B' }}>: {statusLabel}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-5 h-[3px] rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, #2F6FEB)` }} />

      {/* ── Bill To / Invoice details ── */}
      <div className="mt-5 grid grid-cols-2 gap-5">
        <section className="rounded-[10px] border border-[#E6EAF2] p-4">
          <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: NAVY }}>Bill To (Patient)</p>
          <div className="space-y-[5px]">
            <Field label="Patient Name" value={patient?.name ?? invoice.patientName} accent />
            {ageGender && <Field label="Age / Gender" value={ageGender} />}
            {patient?.code && <Field label="Patient ID" value={`#${patient.code}`} />}
            {patient?.phone && <Field label="Phone" value={patient.phone} />}
            {patient?.address && <Field label="Address" value={patient.address.join(', ')} />}
          </div>
        </section>

        <section className="rounded-[10px] border border-[#E6EAF2] p-4">
          <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: NAVY }}>Invoice Details</p>
          <div className="space-y-[5px]">
            <Field label="Invoice No." value={invoice.number} />
            <Field label="Visit Date" value={longDate(invoice.date)} />
            <Field label="Doctor Name" value={doctorName} />
          </div>
        </section>
      </div>

      {/* ── Items ── */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <caption className="sr-only">Invoice line items</caption>
          <colgroup>
            <col style={{ width: '9%' }} /><col style={{ width: '49%' }} /><col style={{ width: '12%' }} /><col style={{ width: '15%' }} /><col style={{ width: '15%' }} />
          </colgroup>
          <thead>
            <tr>
              {['Sr. No.', 'Description', 'Quantity', 'Unit Price (₹)', 'Amount (₹)'].map((h, i, a) => (
                <th key={h} scope="col" className={`h-[34px] px-3 text-[11px] font-bold uppercase tracking-[0.03em] text-white ${i === 0 ? 'rounded-tl-[8px] text-center' : ''} ${i === a.length - 1 ? 'rounded-tr-[8px] text-right' : ''} ${i === 1 ? 'text-left' : 'text-center'} ${i === a.length - 1 ? 'text-right' : ''}`} style={{ background: NAVY }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={`${it.description}-${i}`} className={i % 2 ? 'bg-[#F7F9FD]' : undefined}>
                <td className="h-[38px] border-b border-[#EDF1F8] px-3 text-center text-[11.5px] font-semibold text-[#334155]">{i + 1}</td>
                <th scope="row" className="border-b border-[#EDF1F8] px-3 text-left text-[11.5px] font-bold" style={{ color: NAVY }}>{it.description}</th>
                <td className="border-b border-[#EDF1F8] px-3 text-center text-[11.5px] text-[#334155]">1</td>
                <td className="border-b border-[#EDF1F8] px-3 text-right text-[11.5px] text-[#334155] tabular-nums">{it.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td className="border-b border-[#EDF1F8] px-3 text-right text-[11.5px] font-semibold text-[#0F172A] tabular-nums">{it.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Payment info + totals ── */}
      <div className="mt-5 grid grid-cols-2 items-start gap-5">
        <section className="rounded-[10px] border border-[#E6EAF2] p-4">
          <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: NAVY }}>Payment Information</p>
          <div className="space-y-[5px]">
            <Field label="Status" value={statusLabel} />
            {invoice.paidAt && <Field label="Payment Date" value={longDate(invoice.paidAt)} />}
          </div>
          {invoice.status === 'paid' && (
            <div className="mt-3 flex items-center gap-2.5 rounded-[8px] bg-[#ECFAF1] px-3 py-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#12A150] text-[13px] font-bold text-white">✓</span>
              <span>
                <span className="block text-[11.5px] font-bold text-[#0F7A46]">Thank you!</span>
                <span className="block text-[10.5px] text-[#3F8F63]">Your payment has been received.</span>
              </span>
            </div>
          )}
        </section>

        <section className="rounded-[10px] border border-[#E6EAF2] p-4">
          <dl className="space-y-2">
            <div className="flex justify-between text-[11.5px]"><dt className="font-medium text-[#475569]">Sub Total</dt><dd className="font-semibold text-[#0F172A] tabular-nums">{money(subtotal)}</dd></div>
            {invoice.total !== subtotal && (
              <div className="flex justify-between text-[11.5px]"><dt className="font-medium text-[#475569]">Discount</dt><dd className="font-semibold text-[#0F172A] tabular-nums">– {money(subtotal - invoice.total)}</dd></div>
            )}
            <div className="mt-1 flex justify-between rounded-[7px] px-2.5 py-2" style={{ background: NAVY }}>
              <dt className="text-[12px] font-extrabold text-white">Total Amount</dt>
              <dd className="text-[12px] font-extrabold text-white tabular-nums">{money(invoice.total)}</dd>
            </div>
            <div className="flex justify-between rounded-[7px] bg-[#ECFAF1] px-2.5 py-2">
              <dt className="text-[11.5px] font-bold text-[#0F7A46]">Amount Paid</dt>
              <dd className="text-[11.5px] font-bold text-[#0F7A46] tabular-nums">{money(paid)}</dd>
            </div>
            <div className="flex justify-between rounded-[7px] px-2.5 py-2" style={{ background: balance > 0 ? '#FDECEC' : '#F1F5F9' }}>
              <dt className="text-[11.5px] font-bold" style={{ color: balance > 0 ? '#B42318' : '#475569' }}>Balance Due</dt>
              <dd className="text-[11.5px] font-bold tabular-nums" style={{ color: balance > 0 ? '#B42318' : '#475569' }}>{money(balance)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* ── Note ── */}
      <div className="mt-4 rounded-[8px] bg-[#F7F9FD] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#64748B]">Note:</p>
        <ul className="mt-1 space-y-0.5 text-[10.5px] text-[#64748B]">
          <li>• This is a computer generated invoice.</li>
          <li>• No signature is required.</li>
        </ul>
      </div>

      {/* ── Footer ── */}
      <div className="mt-5 border-t border-[#E6EAF2] pt-4">
        <p className="text-center text-[12px] font-bold italic" style={{ color: NAVY }}>We wish your child a speedy recovery!</p>
        <div className="mt-3.5 grid grid-cols-2 gap-5">
          {timings.length > 0 && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.05em]" style={{ color: NAVY }}>Clinic Timings</p>
              <dl className="mt-1.5 space-y-0.5">
                {timings.map((t) => (
                  <div key={t.days} className="flex gap-2 text-[10.5px]">
                    <dt className="w-[74px] shrink-0 font-semibold text-[#475569]">{t.days}</dt>
                    <dd className={t.time === 'Closed' ? 'font-bold text-[#E03131]' : 'font-semibold text-[#0F172A]'}>{t.time}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {clinic.phone && (
            <div className="text-right">
              <p className="text-[10.5px] font-medium text-[#64748B]">In case of emergency, call us at</p>
              <p className="mt-0.5 text-[13px] font-extrabold" style={{ color: NAVY }}>{clinic.phone}</p>
              {clinic.gstin && <p className="mt-1.5 text-[10px] font-medium text-[#94A3B8]">GSTIN: {clinic.gstin}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
