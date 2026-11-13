import type { Metadata } from 'next';
import { TemplateEditorScreen } from '@/components/contratos/template-editor-screen';

export const metadata: Metadata = {
  title: 'Editar plantilla de contrato',
};

export default async function EditarPlantillaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TemplateEditorScreen templateId={id} />;
}
