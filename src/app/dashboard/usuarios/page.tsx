// /dashboard/usuarios - Solo admin. Lista todos los usuarios con selector de rol.
// Permite crear nuevos miembros del equipo (staff) via modal.
// Incluye matriz de permisos por seccion con overrides por usuario.
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertSectionAccess } from "@/lib/permissions";
import { changeUserRole, createStaffUser, setUserSectionOverride } from "./actions";
import PermissionsMatrix from "./PermissionsMatrix";
import type { UserPermRow, Section } from "./PermissionsMatrix";
import { ALL_SECTIONS } from "./PermissionsMatrix";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Usuarios | Panel Dra. Landaburo" };

const ROLE_LABELS: Record<string, string> = {
  admin:       "Administrador",
  medico:      "Medico/a",
  operativo:   "Operativo/a",
  cosmetologa: "Cosmetologa",
  paciente:    "Paciente",
};

const ROLE_OPTIONS = [
  { value: "admin",       label: "Administrador" },
  { value: "medico",      label: "Medico/a" },
  { value: "operativo",   label: "Operativo/a" },
  { value: "cosmetologa", label: "Cosmetologa" },
  { value: "paciente",    label: "Paciente" },
];

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/dashboard/usuarios");
  const { data: selfProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = selfProfile?.role ?? '';
  if (!role || role === 'paciente') redirect('/portal/paciente');

  // Guard server-side: la matriz de permisos es la unica fuente de verdad (R6)
  await assertSectionAccess(user.id, role, 'usuarios');

  // Leer todos los profiles con admin client para bypasear RLS
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: false });

  const users = profiles ?? [];

  // Construir la matriz de permisos para todos los usuarios no-paciente
  // Leer defaults + overrides en bulk para evitar N+1 queries
  const staffUsers = users.filter((u) => u.role !== "paciente");

  const { data: allDefaults } = await admin
    .from("role_section_defaults")
    .select("role, section, allowed");

  const { data: allOverrides } = await admin
    .from("user_section_overrides")
    .select("profile_id, section, allowed")
    .in("profile_id", staffUsers.map((u) => u.id));

  // Indexar defaults por rol
  const defaultsByRole: Record<string, Record<string, boolean>> = {};
  for (const d of allDefaults ?? []) {
    if (!defaultsByRole[d.role]) defaultsByRole[d.role] = {};
    defaultsByRole[d.role][d.section] = d.allowed;
  }

  // Indexar overrides por user
  const overridesByUser: Record<string, Record<string, boolean>> = {};
  for (const o of allOverrides ?? []) {
    if (!overridesByUser[o.profile_id]) overridesByUser[o.profile_id] = {};
    overridesByUser[o.profile_id][o.section] = o.allowed;
  }

  // Construir UserPermRow para cada usuario staff
  const permRows: UserPermRow[] = staffUsers.map((u) => {
    const roleDefaults = defaultsByRole[u.role] ?? {};
    const userOverrides = overridesByUser[u.id] ?? {};
    const sectionState: Record<string, string> = {};

    for (const section of ALL_SECTIONS) {
      const override = userOverrides[section];
      const fromRole = roleDefaults[section] ?? false;

      if (override !== undefined) {
        sectionState[section] = override ? "override_on" : "override_off";
      } else {
        sectionState[section] = fromRole ? "role_on" : "role_off";
      }
    }

    return {
      id: u.id,
      full_name: u.full_name || "",
      email: u.email,
      role: u.role,
      sectionState: sectionState as UserPermRow["sectionState"],
    };
  });

  // Server action wrapper para pasar al Client Component
  async function handleSetOverride(
    userId: string,
    section: Section,
    allowed: boolean | null
  ) {
    "use server";
    await setUserSectionOverride(userId, section, allowed);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Usuarios</h1>
          <p className={styles.subtitle}>
            {users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Tabla de usuarios */}
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
                <td colSpan={5} className={styles.emptyCell}>No hay usuarios aun.</td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td className={styles.nameCell}>{u.full_name || "—"}</td>
                <td className={styles.emailCell}>{u.email}</td>
                <td>
                  <span className={`${styles.badge} ${styles[`badge_${u.role}`]}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className={styles.dateCell}>
                  {new Date(u.created_at).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
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

      {/* Matriz de permisos por seccion */}
      <PermissionsMatrix users={permRows} setOverrideAction={handleSetOverride} />

      {/* Formulario Nuevo Miembro */}
      <div className={styles.newMember}>
        <h2 className={styles.sectionTitle}>Nuevo miembro del equipo</h2>
        <form action={createStaffUser} className={styles.newForm}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre completo</label>
              <input name="full_name" type="text" required className={styles.input} placeholder="Maria Garcia" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input name="email" type="email" required className={styles.input} placeholder="maria@consultorio.com" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Contrasena temporal</label>
              <input name="password" type="password" required minLength={8} className={styles.input} placeholder="Minimo 8 caracteres" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Rol</label>
              <select name="role" required className={styles.input}>
                <option value="medico">Medico/a</option>
                <option value="operativo">Operativo/a</option>
                <option value="cosmetologa">Cosmetologa</option>
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
