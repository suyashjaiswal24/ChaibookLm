ALTER TABLE "sources" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."sources" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."source_status";--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('uploading', 'extracting', 'chunking', 'embedding', 'ready', 'failed');--> statement-breakpoint
ALTER TABLE "public"."sources" ALTER COLUMN "status" SET DATA TYPE "public"."source_status" USING "status"::"public"."source_status";--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "status" SET DEFAULT 'uploading';
