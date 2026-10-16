import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { parseISO } from "date-fns";
import { newNotificationBase, reminderDates, todayISO, type Habit } from "./habits";
import type { PermissionState } from "./storage";

export const isNative = () => Capacitor.isNativePlatform();
const CHANNEL_ID = "habits";

export async function initNotifications() {
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Напоминания о привычках",
      importance: 4,
      visibility: 1,
    });
  } catch {
    /* channel already exists or unsupported */
  }
}

export async function checkPermission(): Promise<PermissionState> {
  if (!isNative()) return "unsupported";
  const { display } = await LocalNotifications.checkPermissions();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "prompt";
}

export async function ensurePermission(): Promise<PermissionState> {
  if (!isNative()) return "unsupported";
  let state = await checkPermission();
  if (state === "prompt") {
    const { display } = await LocalNotifications.requestPermissions();
    state = display === "granted" ? "granted" : "denied";
  }
  return state;
}

export async function cancelHabit(h: Pick<Habit, "scheduledIds" | "notificationId">) {
  if (!isNative()) return;
  const ids = new Set(h.scheduledIds ?? []);
  if (h.notificationId !== null) ids.add(h.notificationId);
  if (ids.size === 0) return;
  await LocalNotifications.cancel({ notifications: [...ids].map((id) => ({ id })) });
}

/** Schedules reminders and returns the ids to store on the habit. */
export async function scheduleHabit(
  h: Habit,
): Promise<Pick<Habit, "notificationId" | "scheduledIds">> {
  const base = h.notificationId ?? newNotificationBase();
  if (!isNative()) return { notificationId: base, scheduledIds: [] };
  const [hour = 9, minute = 0] = h.reminderTime.split(":").map(Number);
  const today = todayISO();
  const common = {
    title: h.title,
    body: h.description || "Время для вашей привычки",
    channelId: CHANNEL_ID,
    smallIcon: "ic_stat_habit",
    extra: { habitId: h.id },
  };
  let list: LocalNotificationSchema[];
  if (h.endDate === null && h.startDate <= today) {
    // Open-ended habit: one repeating daily notification.
    list = [{ ...common, id: base, schedule: { on: { hour, minute }, allowWhileIdle: true } }];
  } else {
    // Limited or future habit: one notification per day, never after endDate.
    const now = Date.now();
    list = reminderDates(h, today)
      .map((d, i) => {
        const at = parseISO(d);
        at.setHours(hour, minute, 0, 0);
        return { ...common, id: base + i, schedule: { at, allowWhileIdle: true } };
      })
      .filter((n) => n.schedule.at.getTime() > now)
      .slice(0, 64);
  }
  if (list.length) await LocalNotifications.schedule({ notifications: list });
  return { notificationId: base, scheduledIds: list.map((n) => n.id) };
}

interface AppSettingsPlugin {
  open(): Promise<void>;
}
const AppSettingsNative = registerPlugin<AppSettingsPlugin>("AppSettings");

/** Opens Android app notification settings. Returns false if impossible. */
export async function openAppSettings(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    await AppSettingsNative.open();
    return true;
  } catch {
    return false;
  }
}
