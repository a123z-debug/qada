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


const modelCooldownUntil = new Map<string, number>();

export function isModelCoolingDown(model: string): boolean {
  const until = modelCooldownUntil.get(model) || 0;
  if (until <= Date.now()) {
    if (until) modelCooldownUntil.delete(model);
    return false;
  }
  return true;
}

export function markModelQuotaError(model: string, error: unknown): void {
  if (!isQuotaError(error)) return;
  const message = error instanceof Error ? error.message : String(error ?? '');
  const retryMatch = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i)
    || message.match(/retry\s+in\s+(\d+(?:\.\d+)?)s/i);
  const retrySeconds = retryMatch ? Number(retryMatch[1]) : 60;
  const cooldownMs = Math.min(10 * 60_000, Math.max(90_000, Math.ceil(retrySeconds * 1000) + 5_000));
  modelCooldownUntil.set(model, Date.now() + cooldownMs);
}
