export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body: unknown = await res.json();
      if (typeof body === 'object' && body !== null) {
        if ('error' in body && typeof body.error === 'string') message = body.error;
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
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}
