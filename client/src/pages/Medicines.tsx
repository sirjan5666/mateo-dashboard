import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Camera, Check, Clock, Pill, Plus, RotateCcw, ShieldCheck, Stethoscope, Trash2, Undo2, X } from 'lucide-react';
import { addManualMedicines, listMedicines, logDose, ocrPrescription, setCourseActive, undoDose } from '../api/medicines';
import type { MedicineCourse, MedicinesResponse } from '../api/medicines';
import { ApiError } from '../api/client';
import { formatDateIST, formatDateTimeIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { inputCls } from '../components/ui/field';
import { cn } from '../lib/cn';

const keyOf = (c: MedicineCourse) => `${c.prescriptionId}:${c.itemIndex}`;
const sourceLabel = (c: MedicineCourse) => (c.source === 'self' ? 'Added by you' : `Dr. ${c.doctorName ?? ''}`);

type MedRow = { medicine: string; dosage: string; frequency: string; duration: string };
const emptyRow = (): MedRow => ({ medicine: '', dosage: '', frequency: '', duration: '' });

export default function Medicines() {
  const { id } = useParams();
  const [data, setData] = useState<MedicinesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [rows, setRows] = useState<MedRow[]>([emptyRow()]);
  const [savingAdd, setSavingAdd] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [addNotice, setAddNotice] = useState<string | null>(null);

  function setRow(i: number, patch: Partial<MedRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const load = useCallback(async () => {
    if (id === undefined) return;
    setData(await listMedicines(id));
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    listMedicines(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Update one active course's adherence in place (no full reload).
  function patchCourse(k: string, adh: { givenToday: number; lastGivenAt: string | null; totalGiven: number }) {
    setData((prev) => (prev ? { ...prev, active: prev.active.map((c) => (keyOf(c) === k ? { ...c, ...adh } : c)) } : prev));
  }

  async function give(c: MedicineCourse) {
    if (id === undefined) return;
    const k = keyOf(c);
    setBusy(k);
    try {
      patchCourse(k, await logDose(id, c.prescriptionId, c.itemIndex));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save, please try again');
    } finally {
      setBusy(null);
    }
  }

  async function undo(c: MedicineCourse) {
    if (id === undefined) return;
    const k = keyOf(c);
    setBusy(k);
    try {
      patchCourse(k, await undoDose(id, c.prescriptionId, c.itemIndex));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not undo, please try again');
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(c: MedicineCourse, active: boolean) {
    if (id === undefined) return;
    const k = keyOf(c);
    setBusy(k);
    try {
      await setCourseActive(id, c.prescriptionId, c.itemIndex, active);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update, please try again');
    } finally {
      setBusy(null);
    }
  }

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || id === undefined) return;
    setAddNotice(null);
    setOcrLoading(true);
    try {
      const r = await ocrPrescription(id, file);
      if (!r.available) {
        setAddNotice('Photo reading needs a vision-enabled AI — please type the medicines below for now.');
      } else if (r.items.length === 0) {
        setAddNotice(r.error ?? 'Couldn’t read any medicines — please type them below.');
      } else {
        setRows(r.items.map((it) => ({ medicine: it.medicine, dosage: it.dosage, frequency: it.frequency, duration: it.duration })));
        setAddNotice('Read from your photo — please check carefully and edit before saving.');
      }
    } catch (err) {
      setAddNotice(err instanceof Error ? err.message : 'Could not read the photo.');
    } finally {
      setOcrLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function saveManual() {
    if (id === undefined) return;
    const items = rows
      .filter((r) => r.medicine.trim())
      .map((r) => ({ medicine: r.medicine.trim(), dosage: r.dosage.trim() || undefined, frequency: r.frequency.trim() || undefined, duration: r.duration.trim() || undefined }));
    if (items.length === 0) {
      setAddNotice('Add at least one medicine name.');
      return;
    }
    setSavingAdd(true);
    try {
      await addManualMedicines(id, items);
      setShowAdd(false);
      setRows([emptyRow()]);
      setAddNotice(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save, please try again');
    } finally {
      setSavingAdd(false);
    }
  }

  const active = data?.active ?? null;
  const completed = data?.completed ?? [];
  const dosesToday = (active ?? []).reduce((sum, c) => sum + c.givenToday, 0);

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-50">
            <Pill className="h-6 w-6 text-cyan-600" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-stone-900">Medicines</h1>
            <p className="text-sm text-stone-500">From your doctor or added by you — tick off each dose.</p>
          </div>
        </div>
        <Button onClick={() => { setShowAdd((s) => !s); setAddNotice(null); }} variant="secondary" className="gap-1.5">
          {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAdd ? 'Close' : 'Add medicine'}
        </Button>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {showAdd && (
        <Card className="mt-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-stone-800">Add a medicine</h2>
            <div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={(e) => void handlePhoto(e)} className="hidden" />
              <Button type="button" variant="secondary" size="sm" disabled={ocrLoading} onClick={() => fileRef.current?.click()} className="gap-1.5">
                <Camera className="h-4 w-4" />
                {ocrLoading ? 'Reading…' : 'Scan prescription photo'}
              </Button>
            </div>
          </div>
          {addNotice && <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">{addNotice}</p>}

          <div className="mt-3 space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="rounded-xl border border-stone-100 p-3">
                <div className="flex items-center gap-2">
                  <input value={r.medicine} onChange={(e) => setRow(i, { medicine: e.target.value })} placeholder="Medicine name" className={cn(inputCls, 'flex-1')} />
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <input value={r.dosage} onChange={(e) => setRow(i, { dosage: e.target.value })} placeholder="Dosage" className={inputCls} />
                  <input value={r.frequency} onChange={(e) => setRow(i, { frequency: e.target.value })} placeholder="Frequency" className={inputCls} />
                  <input value={r.duration} onChange={(e) => setRow(i, { duration: e.target.value })} placeholder="Duration" className={inputCls} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:text-cyan-800">
              <Plus className="h-4 w-4" /> Add another
            </button>
            <Button onClick={() => void saveManual()} disabled={savingAdd}>{savingAdd ? 'Saving…' : 'Save medicines'}</Button>
          </div>
          <p className="mt-2 text-xs text-stone-400">Always follow your doctor’s original prescription. Reading a photo is a convenience and may have errors — please double-check.</p>
        </Card>
      )}

      {active === null ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : active.length === 0 && completed.length === 0 ? (
        <Card className="mt-5 flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-3xl bg-cyan-50">
            <Pill className="h-8 w-8 text-cyan-600" />
          </span>
          <h3 className="mt-4 font-bold text-stone-800">No medicines yet</h3>
          <p className="mt-1 max-w-xs text-sm text-stone-500">Medicines your doctor prescribes in a consultation will show up here, ready to track.</p>
          <Link to="/find-doctor" className="mt-4">
            <Button variant="secondary" className="gap-1.5"><Stethoscope className="h-4 w-4" /> Find a doctor</Button>
          </Link>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <Card className="mt-5 flex items-center justify-between p-4">
              <p className="text-sm text-stone-600">
                <b className="text-stone-900">{active.length}</b> active {active.length === 1 ? 'medicine' : 'medicines'}
              </p>
              <p className="text-sm text-stone-600">
                <b className="text-stone-900">{dosesToday}</b> {dosesToday === 1 ? 'dose' : 'doses'} given today
              </p>
            </Card>
          )}

          <ol className="mt-3 space-y-3">
            {(active ?? []).map((c) => {
              const k = keyOf(c);
              return (
                <li key={k}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-bold text-stone-900">
                          {c.medicine}
                          {c.dosage && <span className="ml-2 text-sm font-medium text-stone-500">{c.dosage}</span>}
                        </h2>
                        <p className="mt-0.5 text-sm text-stone-600">{[c.frequency, c.duration].filter(Boolean).join(' · ') || 'As directed'}</p>
                        {c.notes && <p className="mt-1 text-sm text-stone-500">{c.notes}</p>}
                        <p className="mt-1 text-xs text-stone-400">{sourceLabel(c)} · {formatDateIST(c.prescribedAt)}</p>
                      </div>
                      <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">{c.givenToday} today</span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
                      <Button onClick={() => void give(c)} disabled={busy === k} size="sm" className="gap-1.5">
                        <Check className="h-4 w-4" /> Mark as given
                      </Button>
                      {c.givenToday > 0 && (
                        <button type="button" onClick={() => void undo(c)} disabled={busy === k} className="inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-700 disabled:opacity-50">
                          <Undo2 className="h-3.5 w-3.5" /> Undo
                        </button>
                      )}
                      {c.lastGivenAt && (
                        <span className="inline-flex items-center gap-1 text-xs text-stone-400">
                          <Clock className="h-3.5 w-3.5" /> Last: {formatDateTimeIST(c.lastGivenAt)}
                        </span>
                      )}
                      <button type="button" onClick={() => void toggleActive(c, false)} disabled={busy === k} className="ml-auto text-sm font-medium text-stone-400 hover:text-stone-700 disabled:opacity-50">
                        Mark finished
                      </button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>

          {completed.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Finished</p>
              <ol className="mt-2 space-y-2">
                {completed.map((c) => {
                  const k = keyOf(c);
                  return (
                    <li key={k}>
                      <Card className="flex items-center justify-between gap-3 p-4 opacity-80">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-700">{c.medicine} {c.dosage && <span className="font-normal text-stone-400">{c.dosage}</span>}</p>
                          <p className="text-xs text-stone-400">{sourceLabel(c)} · {c.totalGiven} doses given</p>
                        </div>
                        <button type="button" onClick={() => void toggleActive(c, true)} disabled={busy === k} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-cyan-700 hover:text-cyan-800 disabled:opacity-50">
                          <RotateCcw className="h-3.5 w-3.5" /> Reactivate
                        </button>
                      </Card>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <p className="mt-4 flex items-start gap-2 text-xs text-stone-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Always follow the dose and timing on your doctor&apos;s prescription and the medicine label. This checklist helps you keep track — it does not change what your doctor advised.
          </p>
        </>
      )}
    </div>
  );
}
