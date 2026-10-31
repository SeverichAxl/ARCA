-- CreateTable
CREATE TABLE "evento_procesado" (
    "event_id" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "procesado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_procesado_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "outbox_evento" (
    "id" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_on" TIMESTAMP(3) NOT NULL,
    "publicado_en" TIMESTAMP(3),
    "intentos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "outbox_evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_evento_publicado_en_occurred_on_idx" ON "outbox_evento"("publicado_en", "occurred_on");
