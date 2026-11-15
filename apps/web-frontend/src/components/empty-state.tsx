export function EmptyState({
  icon,
  title,
  description,
  badge = 'Módulo en construcción',
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[6px] border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[4px] border border-primary/30 bg-primary/15 text-violet-300">
        {icon}
      </div>
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {badge ? (
        <span className="eyebrow mt-4 rounded-[3px] border border-border bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
          {badge}
        </span>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
