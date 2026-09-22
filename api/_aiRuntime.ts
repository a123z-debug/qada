export const USER_AI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
] as const;

export const ECONOMY_AI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
] as const;

export const ADMIN_AI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
] as const;

export function aiErrorStatus(error: unknown): number {
  const anyError = error as any;
  return Number(anyError?.status || anyError?.response?.status || anyError?.error?.code || 0);
}

export function isQuotaError(error: unknown): boolean {
  const status = aiErrorStatus(error);
  const message = error instanceof Error ? error.message : String(error ?? '');
  return status === 429 || /RESOURCE_EXHAUSTED|quota exceeded|rate.?limit|code["']?\s*:\s*429/i.test(message);
}
