import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  // COMPLIANCE: in production this MUST point at a TLS-enabled MongoDB (encryption
  // in transit for PHI) — e.g. append `?tls=true` (Atlas/managed enables it by default).
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  // App-level field encryption for patient PHI (doctor EHR domain). 32 bytes,
  // base64-encoded. MUST NOT be the JWT secret. Optional so the legacy family app
  // boots without it, but the doctor/PHI surface requires it (fieldCipher throws
  // if a PHI write/read is attempted without a valid key). Production target: a
  // managed KMS (envelope encryption) — this single key is the dev/bootstrap form.
  DATA_ENCRYPTION_KEY: z.string().optional(),
  // AI assistant — all optional so the server (and the red-flag safety gate)
  // run without them. Model names are never hardcoded; they come from here.
  // Provider is auto-selected: DeepSeek if its key is set, else Anthropic.
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  // DeepSeek (OpenAI-compatible). DEEPSEEK_MODEL/BASE_URL have sensible defaults.
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
  // Shop / Razorpay — optional. When both are absent, checkout falls back to a
  // clearly-labelled mock payment so the flow is usable in dev. KEY_ID is safe to
  // expose to the client; KEY_SECRET and the webhook secret stay server-side only.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_API_BASE: z.string().default('https://api.razorpay.com/v1'),
  // Admin order-notification email (SMTP via Nodemailer) — all optional. Without
  // these, new-order notifications still land in-app (the Admin → Orders panel);
  // email is only attempted when SMTP is configured.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  // Where new-order emails go. Falls back to every admin user's email if unset.
  ADMIN_NOTIFICATION_EMAIL: z.string().email().optional(),
  // Public URL of the dashboard, used in credential-invite emails ("sign in at …").
  // Optional; dev default matches the Vite preview port.
  APP_BASE_URL: z.string().default('http://localhost:5190'),
}).superRefine((cfg, ctx) => {
  // Validate the PHI encryption key at BOOT (not lazily on first write). When
  // present it must be a 32-byte base64 value and MUST differ from JWT_SECRET
  // (key separation). It is required in production; optional in dev/test so the
  // legacy family app and unit tests boot without it (tests set it per-suite).
  const key = cfg.DATA_ENCRYPTION_KEY;
  if (!key) {
    if (cfg.NODE_ENV === 'production') {
      ctx.addIssue({ code: 'custom', path: ['DATA_ENCRYPTION_KEY'], message: 'DATA_ENCRYPTION_KEY is required in production to handle patient PHI.' });
    }
    return;
  }
  if (Buffer.from(key, 'base64').length !== 32) {
    ctx.addIssue({ code: 'custom', path: ['DATA_ENCRYPTION_KEY'], message: 'DATA_ENCRYPTION_KEY must decode to 32 bytes (base64-encoded).' });
  }
  if (key === cfg.JWT_SECRET) {
    ctx.addIssue({ code: 'custom', path: ['DATA_ENCRYPTION_KEY'], message: 'DATA_ENCRYPTION_KEY must not equal JWT_SECRET (key separation).' });
  }
});

export const env = envSchema.parse(process.env);
