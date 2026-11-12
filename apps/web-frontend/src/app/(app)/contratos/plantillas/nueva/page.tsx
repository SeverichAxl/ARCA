import type { Metadata } from 'next';
import { TemplateEditorScreen } from '@/components/contratos/template-editor-screen';

export const metadata: Metadata = {
  title: 'Nueva plantilla de contrato',
};

export default function NuevaPlantillaPage() {
  return <TemplateEditorScreen />;
}
