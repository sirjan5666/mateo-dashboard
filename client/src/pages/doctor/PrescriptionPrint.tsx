import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { getPrescriptionSheet } from '../../api/doctorPrescriptionDocs';
import { PrescriptionSheet } from '../../components/doctor/v2/PrescriptionSheet';
import { PanelState, useLoad } from '../../components/doctor/v2/workspace/shared';

/**
 * The printable prescription, on its own page.
 *
 * "Download" and "Print" both call window.print(): the print stylesheet renders
 * this exact sheet to A4, and every browser's print dialog offers "Save as PDF".
 * One layout, so the PDF a parent receives is byte-for-byte what the doctor saw
 * — a separate PDF generator would be a second layout free to drift from this one.
 */
export default function PrescriptionPrint() {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data, loading, error } = useLoad(
    async () => {
      if (!id) throw new Error('No prescription selected');
      return getPrescriptionSheet(id);
    },
    [id],
  );

  if (loading || error || !data) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <button type="button" onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-[13.5px] font-semibold text-[#3B4FE0] hover:underline">
          <ArrowLeft className="h-[17px] w-[17px]" />Back
        </button>
        <PanelState loading={loading} error={error} empty={!loading && !error} emptyText="This prescription was not found." />
      </div>
    );
  }

  return (
    <div className="rx-print-page">
      <div className="no-print mb-5 flex flex-wrap items-center gap-3">
        <button type="button"
          onClick={() => (data.patient ? navigate(`/doctor/patients/${data.patient.id}`) : navigate(-1))}
          className="flex items-center gap-2 text-[13.5px] font-semibold text-[#3B4FE0] hover:underline">
          <ArrowLeft className="h-[17px] w-[17px]" />
          {data.patient ? `Back to ${data.patient.displayName}` : 'Back'}
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => window.print()}
            className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
            <Printer className="h-4 w-4 text-[#334155]" />
            <span className="text-[13px] font-bold text-[#1E2A5A]">Print</span>
          </button>
          <button type="button" onClick={() => window.print()}
            className="flex h-[42px] items-center gap-2 rounded-[10px] px-5 text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105"
            style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
            <Download className="h-4 w-4" />
            <span className="text-[13px] font-bold">Download PDF</span>
          </button>
        </div>
      </div>

      <PrescriptionSheet data={data} />

      <p className="no-print mt-4 text-center text-[12px] text-[#64748B]">
        Download opens your browser&rsquo;s print dialog — choose <strong>Save as PDF</strong> as the destination.
      </p>
    </div>
  );
}
