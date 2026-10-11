import { createClient } from '@supabase/supabase-js';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

// In-memory fallback if Supabase table is unreachable or pending DDL
const memoryLimiters = new Map<string, { count: number; resetTime: number }>();

function isMemoryRateLimited(key: string, options: RateLimitOptions): boolean {
  const now = Date.now();
  const entry = memoryLimiters.get(key);
  if (!entry || now > entry.resetTime) {
    memoryLimiters.set(key, { count: 1, resetTime: now + options.windowMs });
    return false;
  }
  if (entry.count >= options.max) {
    return true;
  }
  entry.count += 1;
  return false;
}

/**
 * Limitador de tasa distribuido y persistente contra la tabla public.rate_limits (FIX-029).
 * Sobrevive a reinicios y reloads de PM2 en el servidor.
 * Limpia automáticamente las filas con reset_at expirado y cae a memoria si la tabla no está disponible.
 */
export async function isRateLimited(
  identifier: string,
  namespace: string = 'global',
  options: RateLimitOptions = { windowMs: 60 * 1000, max: 10 }
): Promise<boolean> {
  const key = `${namespace}:${identifier}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + options.windowMs);

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Limpieza de filas vencidas en public.rate_limits
    await supabase
      .from('rate_limits')
      .delete()
      .lt('reset_at', now.toISOString());

    // 2. Consultar entrada existente para la clave
    const { data: existing, error: selectErr } = await supabase
      .from('rate_limits')
      .select('key, count, reset_at')
      .eq('key', key)
      .maybeSingle();

    if (selectErr) {
      // Fallback a memoria si la tabla aún no existe en DB (código 42P01 / PGRST204)
      return isMemoryRateLimited(key, options);
    }

    if (!existing) {
      // Primera solicitud en la ventana
      const { error: insErr } = await supabase.from('rate_limits').insert({
        key,
        count: 1,
        reset_at: resetAt.toISOString(),
        updated_at: now.toISOString(),
      });
      if (insErr) {
        return isMemoryRateLimited(key, options);
      }
      return false;
    }

    // Si ya expiró la ventana temporal
    if (new Date(existing.reset_at).getTime() < now.getTime()) {
      await supabase
        .from('rate_limits')
        .update({
          count: 1,
          reset_at: resetAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('key', key);
      return false;
    }

    // Si excede el máximo permitido
    if (existing.count >= options.max) {
      return true;
    }

    // Incrementar contador
    await supabase
      .from('rate_limits')
      .update({
        count: existing.count + 1,
        updated_at: now.toISOString(),
      })
      .eq('key', key);

    return false;
  } catch {
    return isMemoryRateLimited(key, options);
  }
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') || '127.0.0.1';
}
