import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Calculates whether a given ISO date ('YYYY-MM-DD') is the last business day of its month.
 * Business days: Monday through Friday (1-5).
 */
export function isLastBusinessDayOfMonth(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Find the last day of this month (day 0 of next month)
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0));
  let lastBizDay = lastDayOfMonth;

  // If Sunday (0), move back 2 days to Friday
  if (lastBizDay.getUTCDay() === 0) {
    lastBizDay = new Date(Date.UTC(year, month, -2, 12, 0, 0));
  } else if (lastBizDay.getUTCDay() === 6) {
    // If Saturday (6), move back 1 day to Friday
    lastBizDay = new Date(Date.UTC(year, month, -1, 12, 0, 0));
  }

  const lastBizDayStr = lastBizDay.toISOString().slice(0, 10);
  return dateStr === lastBizDayStr;
}

/**
 * Ensures daily recurring tasks are generated for today (Argentina timezone).
 * Idempotent: only inserts if a task with the same rule_id and due_date doesn't exist.
 * Respects clinic_closed_days.
 */
export async function ensureDailyRecurringTasks(todayAR: string) {
  const admin = createAdminClient();

  // 1. Check if clinic is closed today
  try {
    const { data: closedDays } = await admin
      .from('clinic_closed_days')
      .select('date')
      .eq('date', todayAR);

    if (closedDays && closedDays.length > 0) {
      // Clinic is closed today: do not generate recurring tasks
      return;
    }
  } catch (err) {
    console.warn('[tasks-generator] clinic_closed_days check notice:', err);
  }

  // 2. Fetch active rules
  const { data: rules, error: rulesErr } = await admin
    .from('recurring_task_rules')
    .select('id, title, description, recurrence_type, assigned_profile_id, is_active')
    .eq('is_active', true);

  if (rulesErr || !rules || rules.length === 0) return;

  // 3. Evaluate calendar conditions for today
  const [y, m, d] = todayAR.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayOfWeek = utcDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  const isBusinessDay = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isFriday = dayOfWeek === 5;
  const isLastBizDay = isLastBusinessDayOfMonth(todayAR);

  // 4. Check existing tasks for today
  const { data: existingTasks } = await admin
    .from('staff_tasks')
    .select('rule_id, title')
    .eq('due_date', todayAR);

  const existingRuleIds = new Set((existingTasks ?? []).map((t) => t.rule_id).filter(Boolean));
  const existingTitles = new Set((existingTasks ?? []).map((t) => t.title));

  // 5. Generate missing tasks
  const tasksToInsert = [];

  for (const rule of rules) {
    // on_demand no es una regla periódica de calendario; actúa como contenedor de responsable por defecto
    // para eventos operativos puntuales (ej. empaque de gift cards físicas). Se ignora explícitamente.
    if (rule.recurrence_type === 'on_demand') {
      continue;
    }

    if (existingRuleIds.has(rule.id) || existingTitles.has(rule.title)) continue;

    let shouldTrigger = false;
    if (rule.recurrence_type === 'weekly_friday') {
      shouldTrigger = isFriday;
    } else if (rule.recurrence_type === 'monthly_last_business_day') {
      shouldTrigger = isLastBizDay;
    } else if (rule.recurrence_type === 'daily') {
      // Las tareas diarias se generan únicamente en días hábiles (lunes a viernes)
      shouldTrigger = isBusinessDay;
    } else {
      console.warn(
        `[tasks-generator] Regla "${rule.title}" (ID: ${rule.id}) tiene un recurrence_type no reconocido: "${rule.recurrence_type}". Se omite.`
      );
    }

    if (shouldTrigger) {
      tasksToInsert.push({
        rule_id: rule.id,
        assigned_profile_id: rule.assigned_profile_id,
        task_type: 'recurrente',
        title: rule.title,
        description: rule.description,
        due_date: todayAR,
        status: 'pendiente',
      });
    }
  }

  if (tasksToInsert.length > 0) {
    const { error: insErr } = await admin.from('staff_tasks').insert(tasksToInsert);
    if (insErr) {
      console.error('[tasks-generator] Error generating recurring tasks:', insErr);
    }
  }
}
