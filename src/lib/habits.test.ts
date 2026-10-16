import { describe, expect, it } from "vitest";
import { autoArchive, createDemoHabit, reminderDates, sortByReminder, validateHabit } from "./habits";

const base = {
  title: "Зарядка",
  description: "",
  reminderTime: "08:00",
  startDate: "2026-10-10",
  endDate: null as string | null,
  remindersEnabled: true,
};

describe("habit rules", () => {
  it("requires a title", () => {
    expect(validateHabit({ ...base, title: "  " }).title).toBeDefined();
  });
  it("requires a reminder time", () => {
    expect(validateHabit({ ...base, reminderTime: "" }).reminderTime).toBeDefined();
  });
  it("rejects end date before start date", () => {
    expect(validateHabit({ ...base, endDate: "2026-10-09" }).endDate).toBeDefined();
    expect(validateHabit({ ...base, endDate: "2026-10-10" }).endDate).toBeUndefined();
  });
  it("sorts by reminder time", () => {
    const a = { ...createDemoHabit(), id: "a", reminderTime: "21:00" };
    const b = { ...createDemoHabit(), id: "b", reminderTime: "07:30" };
    expect(sortByReminder([a, b]).map((h) => h.id)).toEqual(["b", "a"]);
  });
  it("auto-archives only habits past their end date", () => {
    const expired = { ...createDemoHabit(), id: "x", endDate: "2026-10-15" };
    const lastDay = { ...createDemoHabit(), id: "y", endDate: "2026-10-16" };
    const forever = { ...createDemoHabit(), id: "z" };
    const { habits } = autoArchive([expired, lastDay, forever], "2026-10-16");
    expect(habits.map((h) => [h.id, h.status, h.archivedReason])).toEqual([
      ["x", "archived", "expired"],
      ["y", "active", null],
      ["z", "active", null],
    ]);
  });
  it("never schedules reminders after the end date", () => {
    expect(reminderDates({ startDate: "2026-10-10", endDate: "2026-10-18" }, "2026-10-16")).toEqual([
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
  });
  it("demo habit is 09:00, open-ended, reminders off", () => {
    const d = createDemoHabit();
    expect([d.title, d.reminderTime, d.endDate, d.remindersEnabled]).toEqual([
      "Выпить стакан воды",
      "09:00",
      null,
      false,
    ]);
  });
});
