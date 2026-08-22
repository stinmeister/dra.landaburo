// /dashboard/usuarios — Solo admin. Lista todos los usuarios con selector de rol.
// Permite crear nuevos miembros del equipo (staff) via modal.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { changeUserRole, createStaffUser } from './actions';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Usuarios | Panel Dra. Landaburo' };

const ROLE_LABELS: Record<string, string> = {
  admin:       'Administrador',
  medico:      'Médico/a',
  operativo:   'Operativo/a',
  cosmetologa: 'Cosmetóloga',
  paciente:    'Paciente',
};

const ROLE_OPTIONS = [
  { value: 'admin',       label: 'Administrador' },
  { value: 'medico',      label: 'Médico/a' },
  { value: 'operativo',   label: 'Operativo/a' },
  { value: 'cosmetologa', label: 'Cosmetóloga' },
  { value: 'paciente',    label: 'Paciente' },
];

export default async function UsuariosPage() {
  // Guard: solo admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: selfProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (selfProfile?.role !== 'admin') redirect('/dashboard/operativo');

  // Leer todos los profiles con admin client para bypasear RLS
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .order('created_at', { ascending: false });

  const users = profiles ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Usuarios</h1>
          <p className={styles.subtitle}>{users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── Tabla de usuarios ── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Registrado</th>
              <th>Cambiar rol</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>No hay usuarios aún.</td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td className={styles.nameCell}>{u.full_name || '—'}</td>
                <td className={styles.emailCell}>{u.email}</td>
                <td>
                  <span className={`${styles.badge} ${styles[`badge_${u.role}`]}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className={styles.dateCell}>
                  {new Date(u.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td>
                  <form action={changeUserRole}>
                    <input type="hidden" name="userId" value={u.id} />
                    <div className={styles.roleRow}>
                      <select name="role" defaultValue={u.role} className={styles.roleSelect}>
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <button type="submit" className={styles.saveBtn}>Guardar</button>
                    </div>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Formulario Nuevo Miembro ── */}
      <div className={styles.newMember}>
        <h2 className={styles.sectionTitle}>Nuevo miembro del equipo</h2>
        <form action={createStaffUser} className={styles.newForm}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre completo</label>
              <input name="full_name" type="text" required className={styles.input} placeholder="María García" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input name="email" type="email" required className={styles.input} placeholder="maria@consultorio.com" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Contraseña temporal</label>
              <input name="password" type="password" required minLength={8} className={styles.input} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Rol</label>
              <select name="role" required className={styles.input}>
                <option value="medico">Médico/a</option>
                <option value="operativo">Operativo/a</option>
                <option value="cosmetologa">Cosmetóloga</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <button type="submit" className={styles.createBtn}>Crear miembro del equipo</button>
        </form>
      </div>
    </div>
  );
}
