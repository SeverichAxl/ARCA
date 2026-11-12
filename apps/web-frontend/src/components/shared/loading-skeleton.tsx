import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function LoadingSkeleton({
  variant = 'table',
  rows = 6,
  className,
}: {
  variant?: 'table' | 'form' | 'page';
  rows?: number;
  className?: string;
}) {
  if (variant === 'form') {
    return (
      <div className={cn('space-y-5', className)} role="status" aria-label="Cargando formulario">
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div className={cn('space-y-4', className)} role="status" aria-label="Cargando página">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Cargando datos">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
