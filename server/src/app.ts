import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import authRouter from './routes/auth.js';
import babiesRouter from './routes/babies.js';
import vaccinesRouter from './routes/vaccines.js';
import growthRouter from './routes/growth.js';
import skinRouter from './routes/skin.js';
import foodRouter from './routes/food.js';
import sleepRouter from './routes/sleep.js';
import milestonesRouter from './routes/milestones.js';
import healthRouter from './routes/health.js';
import accountRouter from './routes/account.js';
import chatRouter from './routes/chat.js';
import overviewRouter from './routes/overview.js';
import adminRouter from './routes/admin.js';
import doctorsRouter from './routes/doctors.js';
import consultationsRouter from './routes/consultations.js';
import referralsRouter from './routes/referrals.js';
import communityRouter from './routes/community.js';
import reportRouter from './routes/report.js';
import symptomsRouter from './routes/symptoms.js';
import medicinesRouter from './routes/medicines.js';
import feedsRouter from './routes/feeds.js';
import diapersRouter from './routes/diapers.js';
import allergiesRouter from './routes/allergies.js';
import insightsRouter from './routes/insights.js';
import shopRouter from './routes/shop.js';
import dosingRouter from './routes/dosing.js';
import doctorPatientsRouter from './routes/doctorPatients.js';
import doctorEncountersRouter from './routes/doctorEncounters.js';
import doctorAppointmentsRouter from './routes/doctorAppointments.js';
import doctorOverviewRouter from './routes/doctorOverview.js';
import doctorGrowthRouter from './routes/doctorGrowth.js';
import doctorVaccinesRouter from './routes/doctorVaccines.js';
import doctorDevelopmentRouter from './routes/doctorDevelopment.js';
import doctorAnalyticsRouter from './routes/doctorAnalytics.js';
import doctorLabsRouter from './routes/doctorLabs.js';
import doctorBillingRouter from './routes/doctorBilling.js';
import doctorPrescriptionsRouter from './routes/doctorPrescriptions.js';
import doctorMessagesRouter from './routes/doctorMessages.js';
import portalRouter from './routes/portal.js';
import { errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  // Trust the first proxy (the Vite dev proxy / a prod reverse proxy) so req.ip and
  // req.secure reflect the real client — needed for correct rate-limiting + cookies.
  app.set('trust proxy', 1);
  // Security response headers (CSP, HSTS, X-Frame-Options, etc.). This is a JSON API
  // consumed same-origin (client served via Vite proxy in dev / same origin in prod),
  // so helmet's defaults are safe. COMPLIANCE: a cross-origin prod deploy would also
  // need a CORS allowlist here.
  app.use(helmet());
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/babies', babiesRouter);
  app.use('/api/overview', overviewRouter);
  // GET /api/babies/:id/vaccines and PATCH /api/vaccines/:doseId
  app.use('/api', vaccinesRouter);
  // GET/POST /api/babies/:id/growth and DELETE /api/babies/:id/growth/:logId
  app.use('/api', growthRouter);
  // GET/POST/DELETE /api/babies/:id/skin and the authenticated photo route
  app.use('/api', skinRouter);
  // GET/POST /api/babies/:id/food and DELETE /api/babies/:id/food/:logId
  app.use('/api', foodRouter);
  // GET/POST /api/babies/:id/sleep and DELETE /api/babies/:id/sleep/:logId
  app.use('/api', sleepRouter);
  // GET /api/babies/:id/milestones and POST/DELETE .../milestones/:milestoneId
  app.use('/api', milestonesRouter);
  // Health records + appointments under /api/babies/:id/{records,appointments}
  app.use('/api', healthRouter);
  // Account-level: DPDP export/delete + emergency contacts + profile
  app.use('/api/account', accountRouter);
  // Admin control panel (admin role only) — creates parent + doctor accounts
  app.use('/api/admin', adminRouter);
  // Doctor onboarding/profile + parent-facing directory & slots
  app.use('/api', doctorsRouter);
  // Consultations: parent books, both parties list/manage
  app.use('/api', consultationsRouter);
  // Refer & Earn: parent's referral code + credits
  app.use('/api', referralsRouter);
  // Community: shared feed where parents post + reply
  app.use('/api', communityRouter);
  // Printable per-baby health report (owner-scoped)
  app.use('/api', reportRouter);
  // Fever / symptom tracker (owner-scoped) with red-flag assessment
  app.use('/api', symptomsRouter);
  // Medicine reminders — courses from prescriptions + dose adherence
  app.use('/api', medicinesRouter);
  // Feeds (milk) + diaper trackers (owner-scoped)
  app.use('/api', feedsRouter);
  app.use('/api', diapersRouter);
  // Allergy profile (owner-scoped)
  app.use('/api', allergiesRouter);
  app.use('/api', insightsRouter);
  // GET/POST /api/babies/:id/chat — red-flag gate runs before any model call
  app.use('/api', chatRouter);
  // Shop: Mateo + Neucomed catalog, cart checkout (Razorpay), orders + admin
  app.use('/api/shop', shopRouter);
  // Pediatric dose-check (doctor decision-support) — catalog + deterministic check
  app.use('/api/dosing', dosingRouter);
  // Doctor EHR: single-doctor patient management (doctor-owned, tenant-scoped PHI)
  app.use('/api/doctor', doctorPatientsRouter);
  // Doctor EHR: clinical encounters (SOAP visit notes), same tenant scoping
  app.use('/api/doctor', doctorEncountersRouter);
  // Doctor EHR: appointments / schedule, same tenant scoping
  app.use('/api/doctor', doctorAppointmentsRouter);
  // Doctor EHR: dashboard overview aggregates
  app.use('/api/doctor', doctorOverviewRouter);
  // Doctor decision-support: non-persisting WHO growth plotter (stores no PHI)
  app.use('/api/doctor', doctorGrowthRouter);
  // Doctor decision-support: non-persisting IAP vaccine schedule (stores no PHI)
  app.use('/api/doctor', doctorVaccinesRouter);
  // Doctor decision-support: non-persisting developmental milestone screen (no PHI)
  app.use('/api/doctor', doctorDevelopmentRouter);
  // Doctor practice analytics: read-only tenant-scoped aggregates (returns no PHI)
  app.use('/api/doctor', doctorAnalyticsRouter);
  // Doctor decision-support: non-persisting lab-results interpreter (stores no PHI)
  app.use('/api/doctor', doctorLabsRouter);
  // Doctor EHR: billing/invoices (tenant-scoped; line items encrypted, totals plain)
  app.use('/api/doctor', doctorBillingRouter);
  // Doctor EHR: prescriptions (per-patient medications)
  app.use('/api/doctor', doctorPrescriptionsRouter);
  // Doctor EHR: doctor<->patient care messages (doctor side)
  app.use('/api/doctor', doctorMessagesRouter);
  // Patient portal: read-only record + care messaging (patient role, strictly scoped)
  app.use('/api/portal', portalRouter);

  app.use(errorHandler);
  return app;
}
