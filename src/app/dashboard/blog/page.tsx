import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertSectionAccess } from "@/lib/permissions";
import { deletePost } from "./actions";
import BlogDeleteButton from "@/components/dashboard/BlogDeleteButton";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Blog CMS | Panel Dra. Landaburo" };

const STATUS_LABELS: Record<string, string> = {
  publicado: "Publicado",
  pendiente: "Pendiente",
  borrador: "Borrador",
};

export default async function BlogDashPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/dashboard/blog");
  const { data: selfProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = selfProfile?.role ?? '';
  if (!role || role === 'paciente') redirect('/portal/paciente');

  // Guard server-side: la matriz de permisos es la unica fuente de verdad (R6)
  await assertSectionAccess(user.id, role, 'blog');

  const admin = createAdminClient();
  const { data: posts } = await admin
    .from("posts")
    .select(
      "id, slug, title, category, is_published, status, published_at, updated_at, created_at"
    )
    .order("created_at", { ascending: false });

  const rows = posts ?? [];
  const published = rows.filter(
    (p) => p.status === "publicado" || p.is_published
  ).length;
  const pending = rows.filter((p) => p.status === "pendiente").length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Blog CMS</h1>
          <p className={styles.subtitle}>
            {published} publicado{published !== 1 ? "s" : ""}
            {pending > 0
              ? ` · ${pending} pendiente${pending !== 1 ? "s" : ""}`
              : ""}
            {" "}· {rows.length - published - pending} borrador
            {rows.length - published - pending !== 1 ? "es" : ""}
          </p>
        </div>
        <Link href="/dashboard/blog/nuevo" className={styles.newBtn}>
          + Nuevo articulo
        </Link>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Titulo</th>
              <th>Categoria</th>
              <th>Estado</th>
              <th>Publicado</th>
              <th>Ultima Edicion</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  No hay articulos aun. Crea el primero.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const statusKey =
                p.status ?? (p.is_published ? "publicado" : "borrador");
              const isPublished = statusKey === "publicado";
              const isPending = statusKey === "pendiente";
              return (
                <tr key={p.id}>
                  <td className={styles.titleCell}>{p.title}</td>
                  <td className={styles.catCell}>{p.category}</td>
                  <td>
                    <span
                      className={
                        isPublished
                          ? styles.badgePublished
                          : isPending
                          ? styles.badgePending ?? styles.badgeDraft
                          : styles.badgeDraft
                      }
                    >
                      {STATUS_LABELS[statusKey] ?? statusKey}
                    </span>
                  </td>
                  <td className={styles.dateCell}>
                    {p.published_at
                      ? new Date(p.published_at).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className={styles.dateCell}>
                    {new Date(
                      p.updated_at ?? p.created_at
                    ).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <Link
                        href={`/dashboard/blog/${p.id}`}
                        className={styles.editBtn}
                      >
                        Editar
                      </Link>
                      {isPublished ? (
                        <Link
                          href={`/blog/${p.slug}`}
                          target="_blank"
                          className={styles.viewBtn}
                        >
                          Ver
                        </Link>
                      ) : (
                        <Link
                          href={`/blog/preview/${p.slug}`}
                          target="_blank"
                          className={styles.viewBtn}
                          style={{ color: "#c05621" }}
                        >
                          Preview
                        </Link>
                      )}
                      <BlogDeleteButton postId={p.id} deleteAction={deletePost} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
