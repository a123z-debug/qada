import {
  toAgentOsRouteInput,
  type AgentOsRouteOverlay,
  type QadaAgentOsPlan,
} from '../src/lib/qadaAgentOs.js';

function isLoopback(url: URL) {
  return ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
}

function disabled(): AgentOsRouteOverlay {
  return {
    status: 'disabled',
    selectedRepositories: [],
    phases: [],
    reviewRequired: [],
  };
}

export async function routeViaAgentOs(
  plan: QadaAgentOsPlan,
): Promise<AgentOsRouteOverlay> {
  const rawBase = String(process.env.AGENT_OS_GATEWAY_URL || '').trim();
  if (!rawBase) return disabled();

  let base: URL;
  try {
    base = new URL(rawBase);
  } catch {
    return { ...disabled(), status: 'unavailable' };
  }

  if (!['http:', 'https:'].includes(base.protocol)) {
    return { ...disabled(), status: 'unavailable' };
  }

  const token = String(process.env.AGENT_OS_ACCESS_TOKEN || '').trim();
  if (!isLoopback(base) && !token) {
    return { ...disabled(), status: 'unavailable' };
  }

  const endpoint = new URL('/route', base);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-QADA-Bridge': 'capabilities-only',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(1400),
      body: JSON.stringify({
        input: toAgentOsRouteInput(plan),
        mode: 'consult',
      }),
    });

    if (!response.ok) {
      return { ...disabled(), status: 'unavailable' };
    }

    const payload: any = await response.json();
    const selected = Array.isArray(payload?.plan?.selected)
      ? payload.plan.selected.slice(0, 8)
      : [];
    const phases = Array.isArray(payload?.plan?.phases)
      ? payload.plan.phases.map((phase: any) => String(phase?.phase || '')).filter(Boolean).slice(0, 8)
      : [];
    const reviewRequired = Array.isArray(payload?.security?.review_required)
      ? payload.security.review_required.map((item: any) => String(item?.name || '')).filter(Boolean).slice(0, 8)
      : [];

    return {
      status: 'ok',
      brainVersion: typeof payload?.brain?.version === 'string' ? payload.brain.version : undefined,
      selectedRepositories: selected.map((item: any) => ({
        name: String(item?.name || ''),
        category: typeof item?.category === 'string' ? item.category : undefined,
        score: typeof item?.score === 'number' ? item.score : undefined,
      })).filter((item: { name: string }) => Boolean(item.name)),
      phases,
      reviewRequired,
    };
  } catch {
    return { ...disabled(), status: 'unavailable' };
  }
}
