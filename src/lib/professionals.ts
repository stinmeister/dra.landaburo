// src/lib/professionals.ts
// Gestión unificada de perfiles de profesionales y resolución de alias/nombres.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProfessionalProfile {
  id: string;
  fullName: string;
  role: string;
  email?: string;
  aliases: string[];
}

/**
 * Normaliza cadenas de texto para comparación flexible de nombres profesionales.
 */
export function normalizeProfText(val: string | null | undefined): string {
  if (!val) return '';
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Genera automáticamente un conjunto de alias reconocibles para una profesional a partir de su nombre.
 */
export function generateProfessionalAliases(fullName: string, role?: string): string[] {
  const aliases = new Set<string>();
  const norm = normalizeProfText(fullName);
  if (!norm) return [];

  aliases.add(norm);

  const parts = norm.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];

    // Invertido: Apellido, Nombre
    aliases.add(`${lastName} ${firstName}`);
    aliases.add(`${lastName} ${parts.slice(0, -1).join(' ')}`);
    aliases.add(`${parts.slice(0, -1).join(' ')} ${lastName}`);

    if (parts.length >= 3) {
      const secondName = parts[1];
      aliases.add(`${secondName} ${lastName}`);
      aliases.add(`${lastName} ${secondName}`);
    }

    // Prefijos médicos
    if (role === 'medico' || role === 'admin') {
      aliases.add(`dra ${lastName}`);
      aliases.add(`dra ${firstName} ${lastName}`);
      aliases.add(`doctora ${lastName}`);
      aliases.add(`doctora ${firstName} ${lastName}`);
    }

    if (lastName.length >= 5) {
      aliases.add(lastName);
    }
  }

  // Alias clínicos tradicionales
  if (norm.includes('landaburo') || norm.includes('natalia') || norm.includes('paula')) {
    aliases.add('nati');
    aliases.add('dra landaburo');
    aliases.add('dra paula landaburo');
    aliases.add('dra natalia landaburo');
    aliases.add('landaburo natalia');
    aliases.add('landaburo paula');
    aliases.add('paula landaburo');
    aliases.add('natalia landaburo');
  }

  if (norm.includes('pasquet') || norm.includes('mercedes')) {
    aliases.add('mechi');
    aliases.add('mechi pasquet');
    aliases.add('mercedes pasquet');
    aliases.add('pasquet mercedes');
    aliases.add('pasquet');
  }

  if (norm.includes('luque') || norm.includes('noelia')) {
    aliases.add('dra luque');
    aliases.add('dra noelia luque');
    aliases.add('luque noelia');
    aliases.add('noelia luque');
  }

  return Array.from(aliases);
}

/**
 * Carga profesionales activos de la clínica desde Supabase y arma un resolvedor rápido en memoria.
 */
export async function loadProfessionals(
  supabaseClient: SupabaseClient
): Promise<{
  professionals: ProfessionalProfile[];
  resolveProfessional: (input: string | null | undefined) => ProfessionalProfile | null;
}> {
  const { data: rows } = await supabaseClient
    .from('profiles')
    .select('id, full_name, role, email')
    .in('role', ['admin', 'medico', 'cosmetologa']);

  const professionals: ProfessionalProfile[] = [];
  const aliasMap = new Map<string, ProfessionalProfile>();

  (rows || []).forEach((p) => {
    if (!p.full_name || !p.id) return;
    const aliases = generateProfessionalAliases(p.full_name, p.role);
    const prof: ProfessionalProfile = {
      id: p.id,
      fullName: p.full_name,
      role: p.role,
      email: p.email,
      aliases,
    };
    professionals.push(prof);

    aliases.forEach((alias) => {
      aliasMap.set(alias, prof);
    });
  });

  function resolveProfessional(input: string | null | undefined): ProfessionalProfile | null {
    if (!input) return null;
    const norm = normalizeProfText(input);
    if (!norm) return null;

    if (aliasMap.has(norm)) {
      return aliasMap.get(norm)!;
    }

    for (const [alias, prof] of aliasMap.entries()) {
      if (alias.length >= 4 && (norm.includes(alias) || alias.includes(norm))) {
        return prof;
      }
    }

    return null;
  }

  return { professionals, resolveProfessional };
}
