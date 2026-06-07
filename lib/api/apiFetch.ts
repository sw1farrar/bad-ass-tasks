let onDualAuthRequired: (() => void) | null = null;

export function registerDualAuthRequiredHandler(handler: (() => void) | null) {
  onDualAuthRequired = handler;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 403) {
    try {
      const body = (await response.clone().json()) as { error?: string };
      if (body.error === "dual_auth_required") {
        onDualAuthRequired?.();
      }
    } catch {
      // ignore parse errors
    }
  }
  return response;
}