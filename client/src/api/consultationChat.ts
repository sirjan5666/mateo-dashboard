import { ApiError } from './client';

export interface ChatMessage {
  id: string;
  senderRole: 'parent' | 'doctor';
  text: string;
  imageUrl: string | null;
  createdAt: string;
}

export function listConsultationMessages(consultId: string) {
  // Plain GET — reuse the shared client.
  return fetchJson<{ messages: ChatMessage[]; role: 'parent' | 'doctor' }>(`/api/consultations/${consultId}/messages`);
}

// Multipart upload — must NOT set a JSON content-type, so we use fetch directly
// and let the browser set the multipart boundary.
export async function sendConsultationMessage(consultId: string, input: { text?: string; image?: File }) {
  const fd = new FormData();
  if (input.text) fd.append('text', input.text);
  if (input.image) fd.append('image', input.image);
  const res = await fetch(`/api/consultations/${consultId}/messages`, {
    method: 'POST',
    body: fd,
    credentials: 'same-origin',
  });
  return parse<{ message: ChatMessage }>(res);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin' });
  return parse<T>(res);
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body: unknown = await res.json();
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') message = body.error;
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}
