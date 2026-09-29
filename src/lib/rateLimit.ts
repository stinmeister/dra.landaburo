// In-memory sliding window rate limiter for public endpoints
interface RateLimitOptions {
  windowMs: number;
  max: number;
}

const limiters = new Map<string, Map<string, { count: number; resetTime: number }>>();

export function isRateLimited(
  identifier: string,
  namespace: string = 'global',
  options: RateLimitOptions = { windowMs: 60 * 1000, max: 10 }
): boolean {
  let namespaceMap = limiters.get(namespace);
  if (!namespaceMap) {
    namespaceMap = new Map();
    limiters.set(namespace, namespaceMap);
  }

  const now = Date.now();
  const entry = namespaceMap.get(identifier);

  if (!entry || now > entry.resetTime) {
    namespaceMap.set(identifier, { count: 1, resetTime: now + options.windowMs });
    return false;
  }

  if (entry.count >= options.max) {
    return true;
  }

  entry.count += 1;
  return false;
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') || '127.0.0.1';
}
