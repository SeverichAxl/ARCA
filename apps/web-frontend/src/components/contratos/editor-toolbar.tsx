'use client';

import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Rows3,
  Table2,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function ToolButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      className={cn('h-8 w-8', active && 'ring-1 ring-blue-500')}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Separator() {
  return <span aria-hidden="true" className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />;
}

/**
 * Barra de formato del editor. Todos los controles tienen nombre accesible y
 * foco visible; los estados se anuncian con `aria-pressed`.
 */
export function EditorToolbar({
  editor,
  disabled = false,
}: {
  editor: Editor | null;
  disabled?: boolean;
}) {
  if (!editor) return null;

  const isDisabled = disabled;
  const inTable = editor.isActive('table');

  return (
    <div
      role="toolbar"
      aria-label="Formato del contenido de la plantilla"
      className="flex flex-wrap items-center gap-0.5 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
    >
      <ToolButton
        label="Negrita"
        active={editor.isActive('bold')}
        disabled={isDisabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Cursiva"
        active={editor.isActive('italic')}
        disabled={isDisabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Subrayado"
        active={editor.isActive('underline')}
        disabled={isDisabled}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline aria-hidden="true" className="h-4 w-4" />
      </ToolButton>

      <Separator />

      <ToolButton
        label="Encabezado nivel 1"
        active={editor.isActive('heading', { level: 1 })}
        disabled={isDisabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Encabezado nivel 2"
        active={editor.isActive('heading', { level: 2 })}
        disabled={isDisabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Encabezado nivel 3"
        active={editor.isActive('heading', { level: 3 })}
        disabled={isDisabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 aria-hidden="true" className="h-4 w-4" />
      </ToolButton>

      <Separator />

      <ToolButton
        label="Lista con viñetas"
        active={editor.isActive('bulletList')}
        disabled={isDisabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Lista numerada"
        active={editor.isActive('orderedList')}
        disabled={isDisabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden="true" className="h-4 w-4" />
      </ToolButton>

      <Separator />

      <ToolButton
        label="Alinear a la izquierda"
        active={editor.isActive({ textAlign: 'left' })}
        disabled={isDisabled}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <AlignLeft aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Alinear al centro"
        active={editor.isActive({ textAlign: 'center' })}
        disabled={isDisabled}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <AlignCenter aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Alinear a la derecha"
        active={editor.isActive({ textAlign: 'right' })}
        disabled={isDisabled}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <AlignRight aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Justificar"
        active={editor.isActive({ textAlign: 'justify' })}
        disabled={isDisabled}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
      >
        <AlignJustify aria-hidden="true" className="h-4 w-4" />
      </ToolButton>

      <Separator />

      <ToolButton
        label="Insertar tabla de 3 por 3"
        disabled={isDisabled}
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      >
        <Table2 aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Agregar fila debajo"
        disabled={isDisabled || !inTable}
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        <Rows3 aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Agregar columna a la derecha"
        disabled={isDisabled || !inTable}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        <Columns3 aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Eliminar tabla"
        disabled={isDisabled || !inTable}
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </ToolButton>

      <Separator />

      <ToolButton
        label="Deshacer"
        disabled={isDisabled || !editor.can().chain().focus().undo().run()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Rehacer"
        disabled={isDisabled || !editor.can().chain().focus().redo().run()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}
