import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 border-brand-500/15 bg-elevated py-10 text-center shadow-glow">
      <div className="mb-1 inline-flex rounded-full bg-brand-500/10 p-3 text-brand-400">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-dim">{description}</p>}
    </div>
  );
}
