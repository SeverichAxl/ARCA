import type { Metadata } from 'next';
import { ExecutiveDashboard } from '@/components/dashboard/executive-dashboard';

export const metadata: Metadata = {
  title: 'Dashboard ejecutivo — ARCA Ltda.',
};

export default function DashboardPage() {
  return <ExecutiveDashboard />;
}
