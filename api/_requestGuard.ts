function firstHeader(req: any, name: string): string {
  const value = req?.headers?.[name] ?? req?.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

function requestHost(req: any): string {
  return firstHeader(req, 'host').split(',')[0].trim().toLowerCase();
}

function urlHost(value: string): string {
  try {
    return new URL(value).host.trim().toLowerCase();
  } catch {
    return '';
  }
}

export function sameOriginMutationAllowed(req: any): boolean {
  const method = String(req?.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

  const host = requestHost(req);
  const origin = firstHeader(req, 'origin');
  const referer = firstHeader(req, 'referer');
  const secFetchSite = firstHeader(req, 'sec-fetch-site').toLowerCase();

  // Direct function invocations, trusted jobs, and non-browser clients may omit
  // Host entirely. Only allow that shape when no browser-origin metadata is
  // present; a browser-like request without Host fails closed.
  if (!host) {
    return !origin && !referer && !secFetchSite;
  }

  if (origin) {
    return urlHost(origin) === host;
  }


  if (referer && urlHost(referer) !== host) {
    return false;
  }

  if (secFetchSite === 'cross-site' || secFetchSite === 'same-site') {
    return false;
  }

  // Non-browser clients frequently omit Origin/Sec-Fetch-*; they remain
  // usable because this guard is specifically for browser CSRF / sibling-site
  // requests. Authentication and authorization still apply independently.
  return true;
}

export function enforceSameOriginMutation(req: any, res: any): boolean {
  if (sameOriginMutationAllowed(req)) return true;
  res.setHeader?.('Cache-Control', 'no-store');
  res.status(403).json({ error: 'CROSS_ORIGIN_MUTATION_BLOCKED' });
  return false;
}
