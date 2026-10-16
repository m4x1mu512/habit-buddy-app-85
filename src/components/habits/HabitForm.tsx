import { useEffect, useId, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { todayISO, validateHabit, type Habit, type HabitInput } from "@/lib/habits";

interface Props {
  open: boolean;
  habit: Habit | null;
  onCancel: () => void;
  onSave: (input: HabitInput) => Promise<void>;
}

const empty = (): HabitInput => ({
  title: "",
  description: "",
  reminderTime: "",
  startDate: todayISO(),
  endDate: null,
  remindersEnabled: true,
});

export function HabitForm({ open, habit, onCancel, onSave }: Props) {
  const [v, setV] = useState<HabitInput>(empty);
  const [term, setTerm] = useState<"forever" | "until">("forever");
  const [errors, setErrors] = useState<ReturnType<typeof validateHabit>>({});
  const [saving, setSaving] = useState(false);
  const uid = useId();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (habit) {
      const { title, description, reminderTime, startDate, endDate, remindersEnabled } = habit;
      setV({ title, description, reminderTime, startDate, endDate, remindersEnabled });
      setTerm(endDate ? "until" : "forever");
    } else {
      setV(empty());
      setTerm("forever");
    }
  }, [open, habit]);

  const set = <K extends keyof HabitInput>(k: K, val: HabitInput[K]) => setV((p) => ({ ...p, [k]: val }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { ...v, title: v.title.trim(), description: v.description.trim(), endDate: term === "until" ? (v.endDate ?? "") : null };
    const errs = validateHabit(input);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await onSave(input);
    } finally {
      setSaving(false);
    }
  };

  const err = (k: keyof HabitInput) =>
    errors[k] ? (
      <p id={`${uid}-${k}-err`} role="alert" className="text-sm font-medium text-destructive">
        ⚠ {errors[k]}
      </p>
    ) : null;
  const aria = (k: keyof HabitInput) => ({
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `${uid}-${k}-err` : undefined,
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onCancel()}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl pb-safe">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl">{habit ? "Редактировать привычку" : "Новая привычка"}</SheetTitle>
          <SheetDescription>Поля со звёздочкой обязательны.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-5 pb-4">
          <div className="grid gap-2">
            <Label htmlFor={`${uid}-title`} className="text-base">Название привычки *</Label>
            <Input id={`${uid}-title`} className="h-12 text-base" value={v.title} maxLength={80}
              onChange={(e) => set("title", e.target.value)} placeholder="Например, утренняя зарядка" {...aria("title")} />
            {err("title")}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${uid}-desc`} className="text-base">Описание</Label>
            <Textarea id={`${uid}-desc`} className="min-h-20 text-base" value={v.description} maxLength={200}
              onChange={(e) => set("description", e.target.value)} placeholder="Текст напоминания" />
          </div>
          <div className="grid grid-cols-1 gap-5 min-[400px]:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`${uid}-time`} className="text-base">Время напоминания *</Label>
              <Input id={`${uid}-time`} type="time" className="h-12 text-base" value={v.reminderTime}
                onChange={(e) => set("reminderTime", e.target.value)} {...aria("reminderTime")} />
              {err("reminderTime")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${uid}-start`} className="text-base">Дата начала</Label>
              <Input id={`${uid}-start`} type="date" className="h-12 text-base" value={v.startDate}
                onChange={(e) => set("startDate", e.target.value)} {...aria("startDate")} />
              {err("startDate")}
            </div>
          </div>
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-base font-medium">Срок действия</legend>
            <RadioGroup value={term} onValueChange={(t) => setTerm(t as "forever" | "until")} className="grid gap-2">
              {([["forever", "Бессрочно"], ["until", "До определённой даты"]] as const).map(([val, label]) => (
                <Label key={val} htmlFor={`${uid}-${val}`}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-base has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-secondary">
                  <RadioGroupItem id={`${uid}-${val}`} value={val} />
                  {label}
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
          {term === "until" && (
            <div className="grid gap-2 animate-rise">
              <Label htmlFor={`${uid}-end`} className="text-base">Дата окончания *</Label>
              <Input id={`${uid}-end`} type="date" className="h-12 text-base" min={v.startDate} value={v.endDate ?? ""}
                onChange={(e) => set("endDate", e.target.value)} {...aria("endDate")} />
              {err("endDate")}
            </div>
          )}
          <Label htmlFor={`${uid}-rem`} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 text-base">
            Напоминания включены
            <Switch id={`${uid}-rem`} checked={v.remindersEnabled} onCheckedChange={(c) => set("remindersEnabled", c)} />
          </Label>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button type="button" variant="outline" size="lg" className="h-12 text-base" onClick={onCancel}>Отмена</Button>
            <Button type="submit" size="lg" className="h-12 text-base" disabled={saving}>Сохранить</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
