-- AlterTable
ALTER TABLE "heartbeat_events" ADD COLUMN "focused_process" TEXT;
ALTER TABLE "heartbeat_events" ADD COLUMN "focused_app" TEXT;
ALTER TABLE "heartbeat_events" ADD COLUMN "focused_window_title" TEXT;

-- CreateTable
CREATE TABLE "app_focus_intervals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "process_name" TEXT NOT NULL,
    "app_name" TEXT NOT NULL,
    "window_title" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_focus_intervals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_focus_intervals_user_id_started_at_idx" ON "app_focus_intervals"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "app_focus_intervals_device_id_ended_at_idx" ON "app_focus_intervals"("device_id", "ended_at");

-- AddForeignKey
ALTER TABLE "app_focus_intervals" ADD CONSTRAINT "app_focus_intervals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_focus_intervals" ADD CONSTRAINT "app_focus_intervals_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
