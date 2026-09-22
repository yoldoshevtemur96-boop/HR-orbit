import type { TimelineStep, WorkflowInstanceStatus } from '@/types/workflow';

const STATUS_STYLES: Record<string, { dot: string; label: string; text: string }> = {
  APPROVED: { dot: 'bg-emerald-500', label: 'Tasdiqladi', text: 'text-emerald-700' },
  REJECTED: { dot: 'bg-rose-500', label: 'Rad etdi', text: 'text-rose-700' },
  PENDING: { dot: 'bg-stone-300', label: 'Navbatda', text: 'text-stone-500' },
  SKIPPED: { dot: 'bg-stone-300', label: "O'tkazib yuborildi", text: 'text-stone-400' },
};

// Xodim ham, HR ham shu komponentni ko'radi: "kimga bordi, kim imzolamay
// turibdi" savoliga bitta qarashda javob beradi. Joriy kutilayotgan bosqich
// urg'u bilan (halqa animatsiyasi) ajratiladi.
export function WorkflowTimeline({
  timeline,
  instanceStatus,
}: {
  timeline: TimelineStep[];
  instanceStatus: WorkflowInstanceStatus;
}) {
  return (
    <ol className="relative flex flex-col gap-0">
      {timeline.map((step, idx) => {
        const style = STATUS_STYLES[step.status] ?? STATUS_STYLES.PENDING;
        const isLast = idx === timeline.length - 1;
        return (
          <li key={step.order} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast && (
              <span
                className={`absolute left-[11px] top-6 h-full w-px ${
                  step.status === 'APPROVED' ? 'bg-emerald-300' : 'bg-stone-200'
                }`}
                aria-hidden
              />
            )}
            <span className="relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center">
              {step.isCurrent && instanceStatus === 'IN_PROGRESS' ? (
                <span className="absolute h-6 w-6 animate-ping rounded-full bg-amber-300 opacity-60" />
              ) : null}
              <span className={`relative h-3 w-3 rounded-full ${style.dot}`} />
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-stone-800">{step.stepName}</p>
                <span className={`text-xs font-medium ${style.text}`}>
                  {step.isCurrent && instanceStatus === 'IN_PROGRESS' ? 'Javob kutilmoqda' : style.label}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-stone-500">
                {step.assignedUser ? step.assignedUser.email : 'Ijrochi hali aniqlanmagan'}
                {step.actedAt ? ` · ${new Date(step.actedAt).toLocaleString('uz-UZ')}` : ''}
              </p>
              {step.comment && (
                <p className="mt-1 rounded-md bg-stone-50 px-2 py-1 text-xs text-stone-600">{step.comment}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
