import { AppHeader } from '@/components/app-header';
import { AppSidebar } from '@/components/app-sidebar';
import { AppRouteGuard } from '@/components/auth/app-route-guard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppRouteGuard>
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />

        <div className="flex min-h-0 flex-1">
          <AppSidebar />

          <main className="app-surface min-w-0 flex-1 px-4 py-6 sm:px-5 sm:py-7 lg:px-7">
            {children}
          </main>
        </div>
      </div>
    </AppRouteGuard>
  );
}
