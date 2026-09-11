"use client";

import { useTransition, useState } from "react";
import { ALL_SECTIONS, type Section } from "@/lib/permissions";
import { setUserSectionOverride } from "./actions";
import styles from "./page.module.css";

export type { Section };

const SECTION_LABELS: Record<Section, string> = {
  ejecutivo:    "Ejecutivo",
  operativo:    "Operativo",
  campanas:     "Campanas",
  tratamientos: "Tratamientos",
  productos:    "Productos",
  usuarios:     "Usuarios",
  blog:         "Blog",
  revision:     "Revisión",
};

export interface UserPermRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  // Computed: seccion -> "role" | "override_on" | "override_off"
  sectionState: Record<Section, "role_on" | "role_off" | "override_on" | "override_off">;
}

interface Props {
  users: UserPermRow[];
  setOverrideAction?: (userId: string, section: Section, allowed: boolean | null) => Promise<void>;
}

export default function PermissionsMatrix({ users, setOverrideAction }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggle = (
    userId: string,
    section: Section,
    currentState: string
  ) => {
    let nextAllowed: boolean | null;
    setErrorMsg(null);

    // Ciclo de estados: role_on -> override_off -> role_on (quita excepcion)
    //                   role_off -> override_on -> role_off (quita excepcion)
    //                   override_on -> null (volver a heredado)
    //                   override_off -> null (volver a heredado)
    if (currentState === "role_on") {
      nextAllowed = false; // agregar excepcion OFF
    } else if (currentState === "role_off") {
      nextAllowed = true; // agregar excepcion ON
    } else {
      nextAllowed = null; // quitar excepcion, volver a heredado
    }

    const key = `${userId}:${section}`;
    setSaving(key);

    startTransition(async () => {
      try {
        if (setOverrideAction) {
          await setOverrideAction(userId, section, nextAllowed);
        } else {
          await setUserSectionOverride(userId, section, nextAllowed);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "No se pudo actualizar el permiso.");
      } finally {
        setSaving(null);
      }
    });
  };

  return (
    <div className={styles.permMatrix}>
      <h2 className={styles.sectionTitle}>Permisos por seccion</h2>
      <p className={styles.permHint}>
        ✓ (permitido) · — (sin acceso) · * (excepción explícita sobre el rol).
        Champagne para permitidos, gris para denegados. Hacer clic para alternar excepción.
      </p>
      {errorMsg && (
        <div style={{
          backgroundColor: "#fef2f2",
          border: "1px solid #f87171",
          color: "#991b1b",
          padding: "0.75rem 1rem",
          borderRadius: "6px",
          marginBottom: "1rem",
          fontSize: "0.875rem"
        }}>
          ⚠️ <strong>Error al actualizar permisos:</strong> {errorMsg}
        </div>
      )}
      <div className={styles.permTableWrap}>
        <table className={styles.permTable}>
          <thead>
            <tr>
              <th className={styles.permUserCol}>Usuario</th>
              <th className={styles.permRoleCol}>Rol</th>
              {ALL_SECTIONS.map((s) => (
                <th key={s} className={styles.permSectionCol}>
                  {SECTION_LABELS[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className={styles.permUserCell}>
                  <div className={styles.permUserName}>{u.full_name || u.email}</div>
                  <div className={styles.permUserEmail}>{u.email}</div>
                </td>
                <td className={styles.permRoleCell}>
                  <span className={styles.permRoleBadge}>{u.role}</span>
                </td>
                {ALL_SECTIONS.map((section) => {
                  const state = u.sectionState[section];
                  const key = `${u.id}:${section}`;
                  const isSaving = saving === key;
                  const isOn = state === "role_on" || state === "override_on";
                  const isOverride = state === "override_on" || state === "override_off";

                  return (
                    <td key={section} className={styles.permCell}>
                      <button
                        onClick={() => handleToggle(u.id, section, state)}
                        disabled={isPending || u.role === "admin"}
                        title={
                          u.role === "admin"
                            ? "Admin siempre tiene acceso total"
                            : isOverride
                            ? "Excepcion explicita — click para heredar del rol"
                            : "Heredado del rol — click para agregar excepcion"
                        }
                        className={[
                          styles.permBtn,
                          isOn ? styles.permBtnOn : styles.permBtnOff,
                          isOverride ? styles.permBtnOverride : "",
                          u.role === "admin" ? styles.permBtnAdmin : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {isSaving ? "…" : isOn ? "✓" : "—"}
                        {isOverride && !isSaving && (
                          <sup className={styles.permOverrideMark}>*</sup>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.permLegend}>* = excepcion explicita (sobreescribe el default del rol)</p>
    </div>
  );
}
