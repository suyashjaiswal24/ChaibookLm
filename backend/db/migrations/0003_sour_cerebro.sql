ALTER TABLE "source_contents" ADD COLUMN "segments" jsonb;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "page_number" integer;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "start_time_seconds" real;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "start_offset" integer;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "end_offset" integer;