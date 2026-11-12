import type { Metadata } from 'next';
import { BoletasAutorizadasScreen } from '@/components/planillas/boletas-autorizadas-screen';

export const metadata: Metadata = {
  title: 'Boletas autorizadas',
};

export default function BoletasPage() {
  return <BoletasAutorizadasScreen />;
}
