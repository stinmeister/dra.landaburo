'use client';
// Client Component for the task list in the Operativo dashboard.
// Needs to be client-side because the toggle button calls a Server Action
// and then refreshes the page via router.refresh() for optimistic-like UX.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleTask } from '@/app/dashboard/operativo/actions';
import styles from './TaskList.module.css';

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
};

type Props = {
  tasks: TaskItem[];
};

export default function TaskList({ tasks }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Track optimistic completed state per task ID
  const [optimisticMap, setOptimisticMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(tasks.map((t) => [t.id, t.is_completed]))
  );

  function handleToggle(taskId: string) {
    const current = optimisticMap[taskId] ?? false;
    // Optimistic update
    setOptimisticMap((prev) => ({ ...prev, [taskId]: !current }));

    startTransition(async () => {
      try {
        await toggleTask(taskId, current);
        router.refresh();
      } catch {
        // Revert optimistic update on error
        setOptimisticMap((prev) => ({ ...prev, [taskId]: current }));
      }
    });
  }

  if (tasks.length === 0) {
    return (
      <p className={styles.empty}>No hay tareas asignadas para hoy.</p>
    );
  }

  const pending = tasks.filter((t) => !optimisticMap[t.id]);
  const completed = tasks.filter((t) => optimisticMap[t.id]);

  return (
    <div className={styles.list}>
      {isPending && <p className={styles.saving}>Guardando...</p>}

      {pending.length > 0 && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Pendientes ({pending.length})</p>
          {pending.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isCompleted={false}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Completadas ({completed.length})</p>
          {completed.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isCompleted={true}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  isCompleted,
  onToggle,
}: {
  task: TaskItem;
  isCompleted: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className={`${styles.row} ${isCompleted ? styles.rowCompleted : ''}`}
    >
      <button
        className={`${styles.checkbox} ${isCompleted ? styles.checkboxChecked : ''}`}
        onClick={() => onToggle(task.id)}
        aria-label={isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'}
        aria-pressed={isCompleted}
      >
        {isCompleted && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <div className={styles.taskContent}>
        <p className={styles.taskTitle}>{task.title}</p>
        {task.description && (
          <p className={styles.taskDesc}>{task.description}</p>
        )}
      </div>
    </div>
  );
}
