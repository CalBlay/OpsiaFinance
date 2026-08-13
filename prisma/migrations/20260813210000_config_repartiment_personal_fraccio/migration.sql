-- Fracció editable del sobrant de personal SC a parts iguals (LN00002 / LN00003).
CREATE TABLE IF NOT EXISTS "ConfigRepartimentPersonal" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "fraccioSobrantIguals" DECIMAL(9,6) NOT NULL DEFAULT 0.5,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigRepartimentPersonal_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ConfigRepartimentPersonal" ("id", "fraccioSobrantIguals", "updatedAt")
VALUES ('default', 0.5, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
