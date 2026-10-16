import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { Archive, ListChecks, Loader2, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HabitForm } from "@/components/habits/HabitForm";
import { ArchiveCard, HabitCard } from "@/components/habits/HabitCards";
import { MANUAL_SETTINGS_HINT, SettingsView } from "@/components/habits/SettingsView";
import { cn } from "@/lib/utils";
import {
  autoArchive, createDemoHabit, isExpired, newId, sortByReminder, todayISO, type Habit, type HabitInput,
} from "@/lib/habits";
import { defaultSettings, loadHabits, loadSettings, saveHabits, saveSettings, type AppSettings, type ThemeMode } from "@/lib/storage";
import { cancelHabit, checkPermission, ensurePermission, initNotifications, isNative, openAppSettings, scheduleHabit } from "@/lib/notifications";
import { applyTheme } from "@/lib/theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Мои привычки — ежедневные напоминания" },
      { name: "description", content: "Простое приложение для привычек с локальными напоминаниями, архивом и тёмной темой." },
      { property: "og:title", content: "Мои привычки" },
      { property: "og:description", content: "Привычки и ежедневные напоминания прямо на вашем Android." },
    ],
  }),
  component: HabitsApp,
});

type Tab = "habits" | "archive" | "settings";
const TITLES: Record<Tab, string> = { habits: "Мои привычки", archive: "Архив", settings: "Настройки" };

function HabitsApp() {
  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [tab, setTab] = useState<Tab>("habits");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [toDelete, setToDelete] = useState<Habit | null>(null);
  const [expiredRestore, setExpiredRestore] = useState<Habit | null>(null);

  const persist = useCallback(async (next: Habit[]) => {
    setHabits(next);
    try {
      await saveHabits(next);
      return true;
    } catch {
      toast.error("Не удалось сохранить данные. Попробуйте ещё раз.");
      return false;
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next).catch(() => toast.error("Не удалось сохранить настройки"));
      return next;
    });
  }, []);

  const deniedToast = useCallback(() => {
    toast.error("Разрешение на уведомления отключено. Включите его в настройках Android", {
      duration: 8000,
      action: {
        label: "Открыть настройки приложения",
        onClick: async () => {
          if (!(await openAppSettings())) toast.info(MANUAL_SETTINGS_HINT, { duration: 10000 });
        },
      },
    });
  }, []);

  /** Schedules reminders for a habit if enabled; returns habit with updated ids. */
  const withSchedule = useCallback(async (h: Habit): Promise<Habit> => {
    const cleared = { ...h, scheduledIds: [] as number[] };
    if (!h.remindersEnabled || h.status !== "active") return { ...cleared, notificationId: null };
    if (!isNative()) return cleared;
    const perm = await ensurePermission();
    updateSettings({ notificationPermission: perm });
    if (perm !== "granted") {
      deniedToast();
      return cleared;
    }
    try {
      return { ...h, ...(await scheduleHabit(h)) };
    } catch {
      toast.error("Не удалось создать напоминание. Привычка сохранена без уведомления.");
      return cleared;
    }
  }, [deniedToast, updateSettings]);

  const safeCancel = async (h: Habit) => {
    try {
      await cancelHabit(h);
    } catch {
      toast.error("Не удалось отменить уведомление");
    }
  };

  // Initial load, demo data, auto-archive, refresh rolling schedules.
  useEffect(() => {
    (async () => {
      try {
        await initNotifications();
        const s = await loadSettings();
        await applyTheme(s.theme);
        let list = (await loadHabits()) ?? [];
        if (!s.seeded && list.length === 0) list = [createDemoHabit()];
        s.seeded = true;
        const { habits: next, expired } = autoArchive(list, todayISO());
        for (const h of expired) await cancelHabit(h).catch(() => {});
        if (expired.length) toast.info(`Срок действия завершён: ${expired.map((h) => `«${h.title}»`).join(", ")}. Перемещено в архив.`);
        s.notificationPermission = await checkPermission().catch(() => "unknown" as const);
        // Re-plan limited habits so the rolling window stays filled.
        const refreshed: Habit[] = [];
        for (const h of next) {
          if (isNative() && h.status === "active" && h.remindersEnabled && s.notificationPermission === "granted") {
            await cancelHabit(h).catch(() => {});
            refreshed.push(await scheduleHabit(h).then((ids) => ({ ...h, ...ids })).catch(() => h));
          } else refreshed.push(h);
        }
        setSettings(s);
        await saveSettings(s);
        await persist(refreshed);
      } catch {
        toast.error("Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    })();
  }, [persist]);

  // Theme + follow system changes.
  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => applyTheme("system");
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [settings.theme]);

  // Android back button.
  const backRef = useRef<() => void>(() => {});
  backRef.current = () => {
    if (toDelete) setToDelete(null);
    else if (expiredRestore) setExpiredRestore(null);
    else if (formOpen) setFormOpen(false);
    else if (tab !== "habits") setTab("habits");
    else CapApp.exitApp();
  };
  useEffect(() => {
    if (!isNative()) return;
    const sub = CapApp.addListener("backButton", () => backRef.current());
    return () => { sub.then((s) => s.remove()); };
  }, []);

  const openForm = (h: Habit | null) => { setEditing(h); setFormOpen(true); };

  const save = async (input: HabitInput) => {
    const now = new Date().toISOString();
    const isEdit = !!editing;
    if (editing) await safeCancel(editing);
    const draft: Habit = editing
      ? { ...editing, ...input, updatedAt: now, isDemo: false }
      : { ...input, id: newId(), notificationId: null, scheduledIds: [], status: "active", archivedReason: null, createdAt: now, updatedAt: now };
    const h = await withSchedule(draft);
    const next = isEdit ? habits.map((x) => (x.id === h.id ? h : x)) : [...habits, h];
    if (await persist(next)) {
      toast.success(isEdit ? "Изменения сохранены" : "Привычка сохранена");
      setFormOpen(false);
    }
  };

  const archive = async (h: Habit) => {
    await safeCancel(h);
    const a: Habit = { ...h, status: "archived", archivedReason: "user", scheduledIds: [], updatedAt: new Date().toISOString() };
    if (await persist(habits.map((x) => (x.id === h.id ? a : x)))) toast.success("Привычка отправлена в архив");
  };

  const restore = async (h: Habit) => {
    if (isExpired(h, todayISO())) { setExpiredRestore(h); return; }
    const r = await withSchedule({ ...h, status: "active", archivedReason: null, updatedAt: new Date().toISOString() });
    if (await persist(habits.map((x) => (x.id === h.id ? r : x)))) toast.success("Привычка восстановлена");
  };

  const remove = async (h: Habit) => {
    await safeCancel(h);
    if (await persist(habits.filter((x) => x.id !== h.id))) toast.success("Привычка удалена");
    setToDelete(null);
  };

  const editExpired = (h: Habit) => {
    setExpiredRestore(null);
    // Edit then restore: open the form with the habit as active.
    openForm({ ...h, status: "active", archivedReason: null });
  };

  const active = sortByReminder(habits.filter((h) => h.status === "active"));
  const archived = sortByReminder(habits.filter((h) => h.status === "archived"));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 bg-appbar pt-safe text-appbar-foreground shadow-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-2 px-4">
          <h1 className="truncate text-xl font-bold">{TITLES[tab]}</h1>
          {tab === "habits" && active.length > 0 && (
            <span className="text-sm opacity-80">{active.length} активн.</span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4">
        {loading ? (
          <div role="status" className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" aria-hidden /> Загрузка…
          </div>
        ) : tab === "habits" ? (
          <>
            <Button size="lg" className="mb-4 h-12 w-full text-base" onClick={() => openForm(null)}>
              <Plus className="size-5" aria-hidden /> Добавить привычку
            </Button>
            {active.length === 0 ? (
              <Empty icon={ListChecks} text="У вас пока нет привычек">
                <Button variant="secondary" className="mt-4 h-11" onClick={() => openForm(null)}>Создать первую привычку</Button>
              </Empty>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {active.map((h) => (
                  <HabitCard key={h.id} habit={h} onEdit={() => openForm(h)} onArchive={() => archive(h)}
                    onDelete={h.isDemo ? () => setToDelete(h) : undefined} />
                ))}
              </div>
            )}
          </>
        ) : tab === "archive" ? (
          archived.length === 0 ? <Empty icon={Archive} text="Архив пуст" /> : (
            <div className="grid gap-3 md:grid-cols-2">
              {archived.map((h) => <ArchiveCard key={h.id} habit={h} onRestore={() => restore(h)} onDelete={() => setToDelete(h)} />)}
            </div>
          )
        ) : (
          <SettingsView theme={settings.theme} onTheme={(t: ThemeMode) => updateSettings({ theme: t })}
            permission={settings.notificationPermission}
            onRequest={async () => { const p = await ensurePermission(); updateSettings({ notificationPermission: p }); if (p === "denied") deniedToast(); }}
            onOpenSettings={openAppSettings} />
        )}
      </main>

      <nav aria-label="Основная навигация" className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 pb-safe backdrop-blur">
        <ul className="mx-auto grid max-w-2xl grid-cols-3">
          {([["habits", "Привычки", ListChecks], ["archive", "Архив", Archive], ["settings", "Настройки", Settings]] as const).map(([id, label, Icon]) => (
            <li key={id}>
              <button onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
                className={cn("flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  tab === id ? "text-primary" : "text-muted-foreground")}>
                <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", tab === id && "bg-secondary")}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <HabitForm open={formOpen} habit={editing} onCancel={() => setFormOpen(false)} onSave={save} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить привычку без возможности восстановления?</AlertDialogTitle>
            <AlertDialogDescription>«{toDelete?.title}» будет удалена навсегда.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Отмена</AlertDialogCancel>
            <AlertDialogAction className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toDelete && remove(toDelete)}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!expiredRestore} onOpenChange={(o) => !o && setExpiredRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Срок действия завершён</AlertDialogTitle>
            <AlertDialogDescription>Чтобы восстановить привычку, сначала измените дату окончания.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Отмена</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={() => expiredRestore && editExpired(expiredRestore)}>Изменить дату</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Empty({ icon: Icon, text, children }: { icon: typeof Archive; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-8" aria-hidden />
      </span>
      <p className="mt-4 text-lg font-medium">{text}</p>
      {children}
    </div>
  );
}
