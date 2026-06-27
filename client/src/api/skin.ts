import { api, ApiError } from './client';

export type SkinSeverity = 'mild' | 'moderate' | 'concerning';

export interface SkinLog {
  id: string;
  loggedAt: string;
  area: string;
  description: string;
  severity: SkinSeverity;
  photoUrl: string | null;
  createdAt: string;
}

export function listSkin(babyId: string) {
  return api<{ logs: SkinLog[] }>(`/babies/${babyId}/skin`);
}

// Multipart upload — must NOT set a JSON Content-Type (browser sets the boundary).
export async function addSkin(babyId: string, form: FormData) {
  const res = await fetch(`/api/babies/${babyId}/skin`, {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body: unknown = await res.json();
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
        message = body.error;
      }
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<{ log: SkinLog }>;
}

export function deleteSkin(babyId: string, logId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/skin/${logId}`, { method: 'DELETE' });
}
