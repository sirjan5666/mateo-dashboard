import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { getInvoice } from '../../api/doctorBilling';
import { getSettings } from '../../api/doctorSettings';
import type { WorkingHours } from '../../api/doctors';
import { useAuth } from '../../auth/context';
import { useActiveLocation } from '../../lib/doctorLocation';
import { InvoiceSheet } from '../../components/doctor/v2/InvoiceSheet';
import type { InvoiceClinic } from '../../components/doctor/v2/InvoiceSheet';
import { PanelState, useLoad } from '../../components/doctor/v2/workspace/shared';
import { fitSheetToOnePage, watchPrint } from '../../lib/fitToPage';

/**
 * The printable invoice, on its own page — same pattern as the prescription:
 * "Print" and "Download PDF" both open the browser dialog on the exact sheet the
 * doctor sees, and the sheet is scaled to fit one A4 page before the dialog opens.
 */
export default function InvoicePrint() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { clinics, active } = useActiveLocation();
  const [scale, setScale] = useState(1);

  const { data, loading, error } = useLoad(
    async () => {
      if (!id) throw new Error('No invoice selected');
      // Settings carries the working hours the footer prints; a failure there
      // must not stop the invoice, so it degrades to no timings.
      const [inv, settings] = await Promise.all([
        getInvoice(id),
        getSettings().catch(() => null),
      ]);
      return { ...inv, hours: (settings?.workingHours ?? null) as WorkingHours | null };
    },
    [id],
  );

  useEffect(() => {
    if (!data) return undefined;
    const t = setTimeout(() => setScale(fitSheetToOnePage()), 0);
    const stop = watchPrint(setScale);
    return () => { clearTimeout(t); stop(); };
  }, [data]);

  function print() {
    setScale(fitSheetToOnePage());
    window.print();
  }

  if (loading || error || !data) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <button type="button" onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-[13.5px] font-semibold text-[#3B4FE0] hover:underline">
          <ArrowLeft className="h-[17px] w-[17px]" />Back
        </button>
        <PanelState loading={loading} error={error} empty={!loading && !error} emptyText="This invoice was not found." />
      </div>
    );
  }

  // Clinic identity for the letterhead: the active clinic, else the primary one.
  const clinicSrc = active && active.id !== 'overall' ? active : clinics.find((c) => c.primary) ?? clinics[0] ?? null;
  const clinic: InvoiceClinic = {
    name: clinicSrc?.name ?? 'Your clinic',
    addressLines: clinicSrc ? [clinicSrc.addressLine, clinicSrc.cityLine].filter(Boolean) : [],
    phone: clinicSrc?.phone ?? '',
    email: clinicSrc?.email ?? '',
    website: '',
    gstin: clinicSrc?.gstin ?? '',
  };

  return (
    <div className="rx-print-page">
      <div className="no-print mb-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => navigate('/doctor/revenue')}
          className="flex items-center gap-2 text-[13.5px] font-semibold text-[#3B4FE0] hover:underline">
          <ArrowLeft className="h-[17px] w-[17px]" />Back to Billing
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <button type="button" onClick={print}
            className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
            <Printer className="h-4 w-4 text-[#334155]" />
            <span className="text-[13px] font-bold text-[#1E2A5A]">Print</span>
          </button>
          <button type="button" onClick={print}
            className="flex h-[42px] items-center gap-2 rounded-[10px] px-5 text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105"
            style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
            <Download className="h-4 w-4" />
            <span className="text-[13px] font-bold">Download PDF</span>
          </button>
        </div>
      </div>

      <InvoiceSheet
        invoice={data.invoice}
        patient={data.patient}
        clinic={clinic}
        doctorName={user?.name ?? 'Doctor'}
        hours={data.hours}
      />

      <p className="no-print mt-4 text-center text-[12px] text-[#64748B]">
        Download opens your browser&rsquo;s print dialog — choose <strong>Save as PDF</strong> as the destination.
        {scale < 0.995 && ` The invoice is scaled to ${Math.round(scale * 100)}% to fit one page.`}
      </p>
    </div>
  );
}
