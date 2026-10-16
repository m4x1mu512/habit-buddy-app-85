import { Preferences } from "@capacitor/preferences";
import type { Habit } from "./habits";

export type ThemeMode = "system" | "light" | "dark";
export type PermissionState = "granted" | "denied" | "prompt" | "unsupported" | "unknown";

export interface AppSettings {
  theme: ThemeMode;
  notificationPermission: PermissionState;
  seeded: boolean;
}

const HABITS_KEY = "myhabits.habits.v1";
const SETTINGS_KEY = "myhabits.settings.v1";

export const defaultSettings: AppSettings = {
  theme: "system",
  notificationPermission: "unknown",
  seeded: false,
};

async function read<T>(key: string, fallback: T): Promise<T> {
  const { value } = await Preferences.get({ key });
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const loadHabits = () => read<Habit[] | null>(HABITS_KEY, null);
export const saveHabits = (habits: Habit[]) =>
  Preferences.set({ key: HABITS_KEY, value: JSON.stringify(habits) });

export const loadSettings = async () => ({
  ...defaultSettings,
  ...(await read<Partial<AppSettings>>(SETTINGS_KEY, {})),
});
export const saveSettings = (s: AppSettings) =>
  Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(s) });
