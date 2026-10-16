import { Archive, Bell, BellOff, CalendarDays, Clock, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ARCHIVE_REASON_LABEL, formatDate, formatPeriod, type Habit } from "@/lib/habits";

const Row = ({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) => (
  <li className="flex items-center gap-2 text-sm text-muted-foreground">
    <Icon className="size-4 shrink-0" aria-hidden />
    <span className="min-w-0 break-words">{children}</span>
  </li>
);

export function HabitCard({ habit, onEdit, onArchive, onDelete }: {
  habit: Habit; onEdit: () => void; onArchive: () => void; onDelete?: () => void;
}) {
  return (
    <article className="animate-rise rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <span className="text-lg font-bold leading-none tabular-nums">{habit.reminderTime}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-lg font-semibold leading-snug">{habit.title}</h3>
          {habit.description && <p className="mt-0.5 break-words text-sm text-muted-foreground">{habit.description}</p>}
        </div>
      </div>
      <ul className="mt-3 grid gap-1.5">
        <Row icon={Clock}>Напоминание в {habit.reminderTime}</Row>
        <Row icon={CalendarDays}>С {formatDate(habit.startDate)} · {habit.endDate ? `до ${formatDate(habit.endDate)}` : "Бессрочно"}</Row>
        <Row icon={habit.remindersEnabled ? Bell : BellOff}>
          {habit.remindersEnabled ? "Уведомления включены" : "Уведомления выключены"}
        </Row>
      </ul>
      <div className="mt-3 flex justify-end gap-1 border-t pt-2">
        {onDelete && (
          <Button variant="ghost" size="icon" className="size-11" aria-label={`Удалить привычку «${habit.title}»`} onClick={onDelete}>
            <Trash2 className="size-5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-11" aria-label={`Редактировать привычку «${habit.title}»`} onClick={onEdit}>
          <Pencil className="size-5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-11" aria-label={`Отправить привычку «${habit.title}» в архив`} onClick={onArchive}>
          <Archive className="size-5" />
        </Button>
      </div>
    </article>
  );
}

export function ArchiveCard({ habit, onRestore, onDelete }: { habit: Habit; onRestore: () => void; onDelete: () => void }) {
  return (
    <article className="animate-rise rounded-2xl border bg-card p-4">
      <h3 className="break-words text-lg font-semibold">{habit.title}</h3>
      <ul className="mt-2 grid gap-1.5">
        <Row icon={Clock}>Напоминание в {habit.reminderTime}</Row>
        <Row icon={CalendarDays}>{formatPeriod(habit)}</Row>
        <Row icon={Archive}>{habit.archivedReason ? ARCHIVE_REASON_LABEL[habit.archivedReason] : ARCHIVE_REASON_LABEL.user}</Row>
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
        <Button variant="outline" className="h-11" onClick={onDelete}>
          <Trash2 className="size-4" aria-hidden /> Удалить
        </Button>
        <Button variant="secondary" className="h-11" onClick={onRestore}>
          <RotateCcw className="size-4" aria-hidden /> Восстановить
        </Button>
      </div>
    </article>
  );
}
