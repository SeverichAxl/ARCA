import type { Metadata } from 'next';
import { MisBoletasScreen } from '@/components/planillas/mis-boletas-screen';

export const metadata: Metadata = {
  title: 'Mis boletas',
};

export default function MisBoletasPage() {
  return <MisBoletasScreen />;
}
