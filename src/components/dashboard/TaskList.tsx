'use client';
// Client Component for the task list in the Operativo dashboard.
// Separates tasks into "Mis tareas", "Del equipo" (with Claim button), and "Completadas".
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleTask, claimTask } from '@/app/dashboard/operativo/actions';
import styles from './TaskList.module.css';

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  due_date?: string | null;
  is_overdue?: boolean;
  assigned_profile_id?: string | null;
  assigned_profile_name?: string | null;
  claimed_by?: string | null;
  claimed_by_name?: string | null;
  completed_by?: string | null;
  completed_by_name?: string | null;
  target_role?: string | null;
  is_team_task?: boolean;
  is_my_task?: boolean;
};

type Props = {
  tasks: TaskItem[];
  currentUserId?: string;
  currentUserRole?: string;
};

export default function TaskList({ tasks, currentUserId, currentUserRole }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Track optimistic completed state per task ID
  const [optimisticMap, setOptimisticMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(tasks.map((t) => [t.id, t.is_completed]))
  );

  function handleToggle(taskId: string) {
    const current = optimisticMap[taskId] ?? false;
    setOptimisticMap((prev) => ({ ...prev, [taskId]: !current }));

    startTransition(async () => {
      try {
        await toggleTask(taskId, current);
        router.refresh();
      } catch {
        setOptimisticMap((prev) => ({ ...prev, [taskId]: current }));
      }
    });
  }

  function handleClaim(taskId: string) {
    setClaimingId(taskId);
    startTransition(async () => {
      try {
        await claimTask(taskId);
        router.refresh();
      } catch (err: any) {
        alert(err?.message || 'Error al tomar la tarea');
      } finally {
        setClaimingId(null);
      }
    });
  }

  if (tasks.length === 0) {
    return <p className={styles.empty}>No hay tareas asignadas para hoy.</p>;
  }

  // Pending tasks that are completed optimistically or not
  const pending = tasks.filter((t) => !optimisticMap[t.id]);
  const completed = tasks.filter((t) => optimisticMap[t.id]);

  // Split pending into "Mis tareas" vs "Del equipo"
  const myTasks = pending.filter((t) => t.is_my_task);
  const teamTasks = pending.filter((t) => !t.is_my_task);

  return (
    <div className={styles.list}>
      {isPending && <p className={styles.saving}>Actualizando tareas...</p>}

      {/* 1. Mis tareas */}
      {myTasks.length > 0 && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Mis tareas ({myTasks.length})</p>
          {myTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isCompleted={false}
              onToggle={handleToggle}
              onClaim={handleClaim}
              isClaiming={claimingId === task.id}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {/* 2. Del equipo */}
      {teamTasks.length > 0 && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Del equipo ({teamTasks.length})</p>
          {teamTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isCompleted={false}
              onToggle={handleToggle}
              onClaim={handleClaim}
              isClaiming={claimingId === task.id}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {/* 3. Completadas */}
      {completed.length > 0 && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Completadas ({completed.length})</p>
          {completed.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isCompleted={true}
              onToggle={handleToggle}
              onClaim={handleClaim}
              isClaiming={false}
              currentUserId={currentUserId}
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
  onClaim,
  isClaiming,
  currentUserId,
}: {
  task: TaskItem;
  isCompleted: boolean;
  onToggle: (id: string) => void;
  onClaim: (id: string) => void;
  isClaiming: boolean;
  currentUserId?: string;
}) {
  const isClaimedByMe = Boolean(currentUserId && task.claimed_by === currentUserId);
  const isClaimedByOther = Boolean(task.claimed_by && (!currentUserId || task.claimed_by !== currentUserId));
  const canClaim = !isCompleted && !task.assigned_profile_id && !task.claimed_by;

  return (
    <div
      className={`${styles.row} ${isCompleted ? styles.rowCompleted : ''} ${
        task.is_overdue && !isCompleted ? styles.rowOverdue : ''
      }`}
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
        <div className={styles.titleRow}>
          <p className={styles.taskTitle}>{task.title}</p>

          {task.is_overdue && !isCompleted && (
            <span className={styles.overdueBadge}>
              Vencida {task.due_date ? `(${task.due_date})` : ''}
            </span>
          )}

          {task.target_role && !task.assigned_profile_id && (
            <span className={styles.teamBadge}>Rol: {task.target_role}</span>
          )}

          {isClaimedByMe && !isCompleted && (
            <span className={styles.claimedBadge}>Tomada por mí</span>
          )}

          {isClaimedByOther && !isCompleted && (
            <span className={styles.claimedBadge}>
              Tomada por {task.claimed_by_name || 'otro miembro'}
            </span>
          )}
        </div>

        {task.description && <p className={styles.taskDesc}>{task.description}</p>}

        {isCompleted && task.completed_by_name && (
          <p className={styles.authorMeta}>Completada por {task.completed_by_name}</p>
        )}
      </div>

      {canClaim && (
        <button
          type="button"
          className={styles.claimBtn}
          onClick={() => onClaim(task.id)}
          disabled={isClaiming}
        >
          {isClaiming ? 'Tomando...' : 'Tomar tarea'}
        </button>
      )}
    </div>
  );
}
