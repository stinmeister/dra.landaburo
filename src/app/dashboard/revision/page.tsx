import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getUserSections } from '@/lib/permissions';
import { getReviewItems } from '@/lib/ingest-review';
import ReviewTable from './ReviewTable';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Registros para Revisión | Panel Dra. Landaburo',
};

export default async function RevisionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/dashboard/revision');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role ?? '';
  if (!role || role === 'paciente') {
    redirect('/portal/paciente');
  }

  // Permiso: accesible si tiene acceso a 'ejecutivo' u 'operativo', o si es admin
  const perms = await getUserSections(user.id, role);
  const canAccess =
    role === 'admin' ||
    perms.allowed.has('ejecutivo') ||
    perms.allowed.has('operativo');

  if (!canAccess) {
    redirect('/dashboard/operativo');
  }

  const items = await getReviewItems({ limit: 200 });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Registros para Revisión</h1>
          <p className={styles.subtitle}>
            Incidencias detectadas durante la ingesta de pacientes y cobros (moneda USD, posibles duplicados, omisiones de contacto).
          </p>
        </div>
      </header>

      <ReviewTable initialItems={items} />
    </div>
  );
}
