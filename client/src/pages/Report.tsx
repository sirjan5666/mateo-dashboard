import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, BookText, Download, FileText } from 'lucide-react';
import { listBabies } from '../api/babies';
import type { Baby } from '../api/babies';
import { getBabyReport } from '../api/report';
import { ApiError } from '../api/client';
import { openReportPdf } from '../lib/reportHtml';
import { formatAge } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/cn';

const INCLUDED = [
  'Cover page with the Mateo logo',
  'About Mateo',
  'Baby profile & birth details',
  'Vaccinations (done, due & upcoming)',
  'Growth measurements',
  'Feeding log',
  'Sleep log',
  'Milestones reached',
  'Skin tracker',
  'Health records & appointments',
];

export default function Report() {
  const [babies, setBabies] = useState<Baby[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listBabies()
      .then((d) => {
        if (cancelled) return;
        setBabies(d.babies);
        setSelectedId(d.babies[0]?.id ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function generate() {
    if (!selectedId) return;
    setError(null);
    setGenerating(true);
    try {
      const report = await getBabyReport(selectedId);
      const opened = openReportPdf(report);
      if (!opened) setError('Please allow pop-ups for this site, then try again — the report opens in a new tab.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not generate the report, please try again');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-purple-50">
          <BookText className="h-6 w-6 text-purple-600" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Report</h1>
          <p className="text-sm text-stone-500">A printable booklet of your baby’s health — download as PDF.</p>
        </div>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {babies === null ? (
        <Card className="mt-5 p-6"><Skeleton className="h-24 w-full" /></Card>
      ) : babies.length === 0 ? (
        <Card className="mt-5 p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-stone-300" />
          <p className="mt-2 text-sm text-stone-500">Add a baby first — then you can generate their health report.</p>
          <Link to="/babies/new" className="mt-3 inline-block">
            <Button>Add your baby</Button>
          </Link>
        </Card>
      ) : (
        <>
          {babies.length > 1 && (
            <Card className="mt-5 p-5">
              <p className="text-sm font-medium text-stone-700">Choose a baby</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {babies.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className={cn(
                      'rounded-xl border px-4 py-2 text-sm font-medium transition-colors',
                      selectedId === b.id ? 'border-purple-400 bg-purple-50 text-purple-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50',
                    )}
                  >
                    {b.name}
                    <span className="ml-1.5 text-xs text-stone-400">{formatAge(b.dob)}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card className="mt-4 overflow-hidden p-0">
            <div className="bg-gradient-to-br from-purple-600 to-fuchsia-600 p-6 text-white">
              <h2 className="text-lg font-extrabold">Baby Health Report</h2>
              <p className="mt-1 text-sm text-white/85">
                A gentle, book-style PDF you can keep or share with your pediatrician.
              </p>
            </div>
            <div className="p-6">
              <p className="text-sm font-semibold text-stone-700">What’s inside</p>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-stone-600">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                    {item}
                  </li>
                ))}
              </ul>

              <Button onClick={() => void generate()} disabled={generating || !selectedId} size="lg" className="mt-5 w-full gap-2">
                <Download className="h-4 w-4" />
                {generating ? 'Preparing…' : 'Download report (PDF)'}
              </Button>
              <p className="mt-2 text-center text-xs text-stone-400">
                Opens in a new tab — choose “Save as PDF” in the print dialog.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
