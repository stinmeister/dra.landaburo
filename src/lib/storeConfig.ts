import { createClient } from '@supabase/supabase-js';

export interface StoreConfig {
  id: number;
  checkout_enabled: boolean;
  shipping_enabled: boolean;
  attention_hours: string;
  allow_oversell_online: boolean;
  pickup_hours: string;
  pickup_address: string;
}

const DEFAULT_STORE_CONFIG: StoreConfig = {
  id: 1,
  checkout_enabled: false,
  shipping_enabled: false,
  attention_hours: 'Lun-Vier: 10:00 – 19:00 hs, Sáb: Solo con cita previa',
  allow_oversell_online: false,
  pickup_hours: 'Lunes a Viernes de 9:00 a 17:00 hs',
  pickup_address: 'Leandro N. Alem 45, Gualeguaychú, Entre Ríos',
};

/**
 * Consulta la configuración de la tienda y consultorio directamente desde Supabase en tiempo real.
 * Desactiva explícitamente el cache para reflejar cambios inmediatos de store_config.
 */
export async function getStoreConfig(): Promise<StoreConfig> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: {
          fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }),
        },
      }
    );

    const { data, error } = await supabase
      .from('store_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (!error && data) {
      return {
        ...DEFAULT_STORE_CONFIG,
        ...data,
        attention_hours: data.attention_hours || DEFAULT_STORE_CONFIG.attention_hours,
      };
    }
  } catch (err) {
    console.warn('[storeConfig] Error consultando store_config en DB, usando fallback:', err);
  }

  return DEFAULT_STORE_CONFIG;
}
