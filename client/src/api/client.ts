export class ApiError extends Error {
  status: number;
  /** Machine-readable error code from the server (e.g. 'baby_limit_reached'). */
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const body: unknown = await res.json();
      if (typeof body === 'object' && body !== null) {
        if ('error' in body && typeof body.error === 'string') message = body.error;
        if ('code' in body && typeof body.code === 'string') code = body.code;
        // Validation failures carry per-field details — surface them so the user
        // sees *what* was wrong instead of a generic "Invalid request".
        if ('details' in body && Array.isArray(body.details)) {
          const parts = (body.details as Array<{ message?: unknown }>)
            .map((d) => (typeof d?.message === 'string' ? d.message : null))
            .filter((m): m is string => !!m);
          if (parts.length) message = parts.join('. ');
        }
      }
    } catch {
      // response body was not JSON; keep the generic message
    }
    throw new ApiError(res.status, message, code);
  }
  return res.json() as Promise<T>;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'same-origin',
  });
  return unwrap<T>(res);
}

/**
 * Multipart POST. Deliberately sets NO Content-Type — the browser has to add the
 * multipart boundary itself, and forcing application/json would break the parse.
 */
export async function apiForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, { method: 'POST', body: form, credentials: 'same-origin' });
  return unwrap<T>(res);
}
