import { addDays, format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

export type HabitStatus = "active" | "archived";
export type ArchivedReason = "user" | "expired";

export interface Habit {
  id: string;
  title: string;
  description: string;
  /** "HH:mm" */
  reminderTime: string;
  /** "yyyy-MM-dd" */
  startDate: string;
  endDate: string | null;
  remindersEnabled: boolean;
  notificationId: number | null;
  /** All notification ids currently scheduled for this habit. */
  scheduledIds: number[];
  status: HabitStatus;
  archivedReason: ArchivedReason | null;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
}

export interface HabitInput {
  title: string;
  description: string;
  reminderTime: string;
  startDate: string;
  endDate: string | null;
  remindersEnabled: boolean;
}

export const ARCHIVE_REASON_LABEL: Record<ArchivedReason, string> = {
  user: "Перемещено пользователем",
  expired: "Срок действия завершён",
};

/** Maximum days ahead to schedule one-off reminders for habits with an end date. */
export const SCHEDULE_WINDOW_DAYS = 60;

export const todayISO = (now: Date = new Date()) => format(now, "yyyy-MM-dd");

export const formatDate = (iso: string) => format(parseISO(iso), "d MMMM yyyy", { locale: ru });

export const formatPeriod = (h: Pick<Habit, "startDate" | "endDate">) =>
  `${formatDate(h.startDate)} — ${h.endDate ? formatDate(h.endDate) : "Бессрочно"}`;

export function validateHabit(input: HabitInput): Partial<Record<keyof HabitInput, string>> {
  const errors: Partial<Record<keyof HabitInput, string>> = {};
  if (!input.title.trim()) errors.title = "Введите название привычки";
  if (!/^\d{2}:\d{2}$/.test(input.reminderTime)) errors.reminderTime = "Укажите время напоминания";
  if (!input.startDate) errors.startDate = "Укажите дату начала";
  if (input.endDate !== null) {
    if (!input.endDate) errors.endDate = "Укажите дату окончания";
    else if (input.startDate && input.endDate < input.startDate)
      errors.endDate = "Дата окончания не может быть раньше даты начала";
  }
  return errors;
}

export const sortByReminder = (habits: Habit[]) =>
  [...habits].sort(
    (a, b) => a.reminderTime.localeCompare(b.reminderTime) || a.title.localeCompare(b.title, "ru"),
  );

export const isExpired = (h: Pick<Habit, "endDate">, today: string) =>
  h.endDate !== null && today > h.endDate;

/** Moves active habits whose end date has passed into the archive. Never deletes. */
export function autoArchive(habits: Habit[], today: string, nowIso = new Date().toISOString()) {
  const expired: Habit[] = [];
  const next = habits.map((h) => {
    if (h.status === "active" && isExpired(h, today)) {
      expired.push(h);
      return {
        ...h,
        status: "archived" as const,
        archivedReason: "expired" as const,
        notificationId: null,
        scheduledIds: [],
        updatedAt: nowIso,
      };
    }
    return h;
  });
  return { habits: next, expired };
}

/** Dates (yyyy-MM-dd) on which a one-off reminder should fire, never after endDate. */
export function reminderDates(
  h: Pick<Habit, "startDate" | "endDate">,
  today: string,
  maxDays = SCHEDULE_WINDOW_DAYS,
): string[] {
  const from = h.startDate > today ? h.startDate : today;
  const limit = todayISO(addDays(parseISO(today), maxDays));
  const to = h.endDate && h.endDate < limit ? h.endDate : limit;
  const out: string[] = [];
  for (let d = parseISO(from); todayISO(d) <= to; d = addDays(d, 1)) out.push(todayISO(d));
  return out;
}

export function createDemoHabit(now: Date = new Date()): Habit {
  const iso = now.toISOString();
  return {
    id: "demo-water",
    title: "Выпить стакан воды",
    description: "",
    reminderTime: "09:00",
    startDate: todayISO(now),
    endDate: null,
    remindersEnabled: false,
    notificationId: null,
    scheduledIds: [],
    status: "active",
    archivedReason: null,
    createdAt: iso,
    updatedAt: iso,
    isDemo: true,
  };
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Base notification id; per-day ids are base + index (index < 100). Fits Java int. */
export const newNotificationBase = () => (Math.floor(Math.random() * 20_000_000) + 1) * 100;
