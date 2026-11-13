import type { Metadata } from 'next';
import { PlantillasList } from '@/components/contratos/plantillas-list';

export const metadata: Metadata = {
  title: 'Plantillas de contrato',
};

export default function PlantillasPage() {
  return <PlantillasList />;
}
