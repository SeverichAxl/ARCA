# @arca/messaging

Utilidades comunes de RabbitMQ para servicios ARCA. El exchange `arca.events`
es durable; cada consumidor declara su cola durable, `<cola>.retry` (TTL
configurable, 10 s por defecto y dead-letter a la cola principal) y
`<cola>.dlq`. Se confirma el mensaje original solo tras confirmar el reintento o
el registro idempotente.

## Registrar un evento en la transacción de negocio

```ts
await prisma.$transaction(async (tx) => {
  await tx.empleado.update({ where: { id }, data: cambios });
  await outbox.add(tx, 'EMPLEADO_MODIFICADO', payload);
});
```

`OutboxPublisher` publica cada segundo en lotes, bloquea pendientes con
`FOR UPDATE SKIP LOCKED`, publica mensajes persistentes con confirmación y marca
`publicado_en` solo tras confirmar el broker. Los fallos dejan el registro
pendiente e incrementan `intentos`.

## Consumir eventos

`MessagingModule.register` recibe el cliente Prisma de cada servicio, la
conexión RabbitMQ y los handlers. `EventConsumer.subscribe(queue, bindings,
handler)` persiste `EventoProcesado` y ejecuta el handler en la misma
transacción. La clave única `eventId` deduplica entregas; ms-auth puede lanzar
`DuplicateEventError` al detectar el unique de `auditoria_log.event_id`.

```ts
MessagingModule.register({
  connection: {
    hostname: process.env.RABBITMQ_HOST!,
    port: Number(process.env.RABBITMQ_PORT ?? 5672),
    username: process.env.RABBITMQ_USER!,
    password: process.env.RABBITMQ_PASSWORD!,
    vhost: process.env.RABBITMQ_VHOST ?? 'arca',
  },
  prismaToken: PrismaService,
  producer: 'ms-personal',
});
```

El límite son tres intentos totales. Los dos primeros fallos van a la cola de
reintento con `x-retry-count`; el tercero va a la DLQ. La librería reconecta
automáticamente y cierra canales y conexión al apagar Nest.
