"use client";

import { useTransition } from "react";
import styles from "@/app/dashboard/blog/page.module.css";

interface Props {
  postId: string;
  deleteAction: (formData: FormData) => Promise<void>;
}

export default function BlogDeleteButton({ postId, deleteAction }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!confirm("Eliminar este articulo permanentemente?")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", postId);
      await deleteAction(fd);
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={isPending}
        className={styles.deleteBtn}
      >
        {isPending ? "..." : "Eliminar"}
      </button>
    </form>
  );
}
