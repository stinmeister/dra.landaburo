// Carga paginada del padrón de pacientes para la ingesta (FIX-137, parcial).
// PostgREST corta en 1.000 filas por defecto: esta función pagina con .range()
// ordenando por id para que el corte entre páginas sea estable.

export interface PatientRow {
  id: string;
  full_name: string | null;
}

export interface PatientsPageQuery {
  from: (table: 'patients') => {
    select: (columns: 'id, full_name') => {
      order: (
        column: 'id',
        opts: { ascending: boolean }
      ) => {
        range: (
          from: number,
          to: number
        ) => PromiseLike<{
          data: PatientRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export const DEFAULT_PATIENTS_PAGE_SIZE = 1000;

export async function loadAllPatientsForIngest(
  client: PatientsPageQuery,
  pageSize: number = DEFAULT_PATIENTS_PAGE_SIZE,
  logger: Pick<Console, 'log'> = console,
  logPrefix: string = '[ingest/payments]'
): Promise<PatientRow[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error(`pageSize inválido: ${pageSize}`);
  }

  const all: PatientRow[] = [];
  let offset = 0;
  let pages = 0;

  while (true) {
    const { data, error } = await client
      .from('patients')
      .select('id, full_name')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(
        `Error cargando padrón de pacientes (página ${pages + 1}, offset ${offset}): ${error.message}`
      );
    }

    const rows = data ?? [];
    all.push(...rows);
    pages += 1;

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  logger.log(
    `${logPrefix} Padrón de pacientes cargado: ${all.length} filas en ${pages} página(s) de ${pageSize}`
  );

  return all;
}
