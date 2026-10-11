-- Deep focus context: optional URL and detail on heartbeats / focus intervals
ALTER TABLE "heartbeat_events" ADD COLUMN IF NOT EXISTS "focused_url" TEXT;
ALTER TABLE "heartbeat_events" ADD COLUMN IF NOT EXISTS "focused_detail" TEXT;

ALTER TABLE "app_focus_intervals" ADD COLUMN IF NOT EXISTS "url" TEXT;
ALTER TABLE "app_focus_intervals" ADD COLUMN IF NOT EXISTS "detail" TEXT;
