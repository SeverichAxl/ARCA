import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma as AuthPrisma } from '../services/ms-auth/prisma/generated/client';
import { Prisma as PersonalPrisma } from '../services/ms-personal/prisma/generated/client';
import { Prisma as VacacionesPrisma } from '../services/ms-vacaciones/prisma/generated/client';
import { Prisma as ContratosPrisma } from '../services/ms-contratos/prisma/generated/client';
import { Prisma as PlanillasPrisma } from '../services/ms-planillas/prisma/generated/client';

interface ModelField {
  name: string;
  dbName?: string | null;
  kind: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  isUnique: boolean;
  isId: boolean;
  hasDefaultValue: boolean;
  default?: unknown;
  relationName?: string;
  relationFromFields?: string[];
  relationToFields?: string[];
}

interface DataModel {
  name: string;
  dbName?: string | null;
  fields: ModelField[];
  uniqueFields: string[][];
  primaryKey?: { fields: string[] } | null;
}

interface ServiceDocs {
  name: string;
  dmmf: { datamodel: { models: DataModel[] } };
  notes: string[];
}

const services: ServiceDocs[] = [
  {
    name: 'auth',
    dmmf: AuthPrisma.dmmf,
    notes: [
      'Usuario.empleadoId es una referencia UUID sin FK a db_personal.empleado.',
      'passwordHash almacena hashes Argon2id, nunca contraseñas.',
      'RefreshToken.tokenHash almacena SHA-256 del token opaco; familyId se conserva solo en esta tabla.',
      'AuditoriaLog es solo inserción; el payload debe llegar con CI/sueldos enmascarados.',
    ],
  },
  {
    name: 'personal',
    dmmf: PersonalPrisma.dmmf,
    notes: [
      'CI y remuneraciones se cifran con AES-256-GCM; ciHash es HMAC-SHA256 para igualdad exacta.',
      'creadoPor, registradoPor y Area.jefeId son UUID de otros agregados/cuentas; no deben interpretarse como FKs entre bases.',
      'firmaPublicId y los IDs de respaldo son referencias a almacenamiento externo, no URLs firmadas.',
      'OutboxEvento se escribe en la misma transacción del cambio de negocio.',
    ],
  },
  {
    name: 'vacaciones',
    dmmf: VacacionesPrisma.dmmf,
    notes: [
      'EmpleadoRef es una copia local mínima recibida por eventos; no almacena CI ni sueldo.',
      'empleadoId de EmpleadoRef no es una FK entre bases; jefeEmpleadoId y actores son UUID referenciales.',
      'OutboxEvento se escribe junto al cambio local; EventoProcesado aporta idempotencia.',
    ],
  },
  {
    name: 'contratos',
    dmmf: ContratosPrisma.dmmf,
    notes: [
      'Esquema stub de Sprint 1: contiene únicamente infraestructura de eventos.',
      'EventoProcesado y OutboxEvento son locales a esta base; no hay FKs entre servicios.',
    ],
  },
  {
    name: 'planillas',
    dmmf: PlanillasPrisma.dmmf,
    notes: [
      'Esquema stub de Sprint 1: contiene únicamente infraestructura de eventos.',
      'EventoProcesado y OutboxEvento son locales a esta base; los conceptos de nómina pertenecen a Sprint 2.',
    ],
  },
];

function renderDefault(field: ModelField): string {
  if (!field.hasDefaultValue) {
    return '—';
  }
  if (typeof field.default === 'string') {
    return `\`${field.default}\``;
  }
  return `\`${JSON.stringify(field.default)}\``;
}

function renderDictionary(service: ServiceDocs): string {
  const sections = service.dmmf.datamodel.models.map((model) => {
    const tableName = model.dbName ?? model.name;
    const fields = model.fields.filter((field) => field.kind !== 'object');
    const relations = model.fields.filter((field) => field.kind === 'object');
    const primaryFields = new Set(model.primaryKey?.fields ?? []);

    const rows = fields.map((field) => {
      const keys = [
        field.isId || primaryFields.has(field.name) ? 'PK' : '',
        field.isUnique ? 'UNIQUE' : '',
      ]
        .filter(Boolean)
        .join(', ') || '—';
      return `| \`${field.dbName ?? field.name}\` | \`${field.type}\` | ${field.isRequired ? 'No' : 'Sí'} | ${renderDefault(field)} | ${keys} | — |`;
    });
    const relationRows = relations.map((field) => {
      const from = field.relationFromFields?.join(', ') || 'relación inversa';
      const to = field.relationToFields?.join(', ') || '—';
      return `| — | — | — | — | — | \`${field.name}\`: ${field.relationName ?? field.type} (${from} → ${to}) |`;
    });

    const compoundUniqueConstraints = model.uniqueFields.filter((constraint) => constraint.length > 1);
    return [
      `## Tabla \`${tableName}\` (\`${model.name}\`)`,
      '',
      '| Columna | Tipo | Nulo | Default | Único / clave | Relación |',
      '|---|---|---:|---|---|---|',
      ...rows,
      ...relationRows,
      ...(compoundUniqueConstraints.length
        ? [
            '',
            `Restricciones únicas compuestas: ${compoundUniqueConstraints.map((fields) => `\`(${fields.join(', ')})\``).join(', ')}.`,
          ]
        : []),
      '',
    ].join('\n');
  });

  return [
    `# Diccionario de datos — db_${service.name}`,
    '',
    'Generado desde el DMMF del cliente Prisma. Las columnas muestran el nombre físico y los campos escalares; las relaciones se documentan aparte para distinguir las relaciones entre modelos.',
    '',
    ...sections,
    '## Notas',
    '',
    ...service.notes.map((note) => `- ${note}`),
    '',
  ].join('\n');
}

function renderMermaid(service: ServiceDocs): string {
  const models = service.dmmf.datamodel.models;
  const declarations = models.map((model) => {
    const fields = model.fields
      .filter((field) => field.kind !== 'object')
      .map((field) => {
        const key = field.isId
          ? ' PK'
          : field.isUnique
            ? ' UK'
            : '';
        return `    ${field.type} ${field.dbName ?? field.name}${key}`;
      });
    return `  ${model.name} {\n${fields.join('\n')}\n  }`;
  });
  const relations = models.flatMap((model) =>
    model.fields
      .filter((field) => field.kind === 'object' && field.relationFromFields?.length)
      .map((field) => {
        const target = field.type;
        const from = field.isRequired ? '||' : 'o|';
        const to = field.isList ? '}o' : '||';
        return `  ${target} ${from}--${to} ${model.name} : "${field.relationName ?? field.name}"`;
      }),
  );
  const uniqueConstraints = models.flatMap((model) =>
    model.uniqueFields
      .filter((fields) => fields.length > 1)
      .map((fields) => `  %% UNIQUE ${model.dbName ?? model.name}(${fields.join(', ')})`),
  );

  return [
    `# Modelo entidad-relación — db_${service.name}`,
    '',
    'Generado desde el DMMF del cliente Prisma.',
    '',
    '```mermaid',
    'erDiagram',
    ...declarations,
    ...relations,
    ...uniqueConstraints,
    '```',
    '',
  ].join('\n');
}

for (const service of services) {
  const dictionaryPath = resolve(`docs/db/diccionario-${service.name}.md`);
  const merPath = resolve(`docs/db/mer-${service.name}.md`);
  writeFileSync(dictionaryPath, renderDictionary(service), 'utf8');
  writeFileSync(merPath, renderMermaid(service), 'utf8');
  console.log(`Generados ${dictionaryPath} y ${merPath}`);
}
