import type { LucideIcon } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-3xl p-8 text-center">
      {Icon && <Icon className="h-8 w-8 text-white/25" />}
      <p className="text-sm font-semibold text-white/70">{title}</p>
      {description && <p className="text-xs text-white/40">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-ghost mt-1 px-5 py-2 text-sm">
          {action.label}
        </button>
      )}
    </div>
  );
}
