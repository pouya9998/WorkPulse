-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "WorkSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AttendanceEventType" AS ENUM (
  'WORK_START',
  'WORK_END',
  'HEARTBEAT',
  'IDLE_START',
  'IDLE_END',
  'SCREEN_LOCK',
  'SCREEN_UNLOCK',
  'AGENT_ONLINE',
  'AGENT_OFFLINE'
);

-- CreateEnum
CREATE TYPE "DeviceStateType" AS ENUM ('ACTIVE', 'IDLE', 'LOCKED', 'OFFLINE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "registered_devices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "os_version" TEXT,
    "agent_version" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMP(3),
    "last_heartbeat_at" TIMESTAMP(3),
    "last_ip_address" TEXT,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registered_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT,
    "status" "WorkSessionStatus" NOT NULL DEFAULT 'OPEN',
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "started_at_device" TIMESTAMP(3),
    "ended_at_device" TIMESTAMP(3),
    "start_event_id" TEXT,
    "end_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT,
    "work_session_id" TEXT,
    "client_event_id" TEXT NOT NULL,
    "type" "AttendanceEventType" NOT NULL,
    "occurred_at_device" TIMESTAMP(3) NOT NULL,
    "received_at_server" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence" BIGINT,
    "out_of_order" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "heartbeat_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "work_session_id" TEXT,
    "client_event_id" TEXT NOT NULL,
    "sent_at_device" TIMESTAMP(3) NOT NULL,
    "received_at_server" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idle_seconds" INTEGER,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "agent_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "heartbeat_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_state_intervals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "work_session_id" TEXT,
    "state" "DeviceStateType" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "source_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_state_intervals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registered_devices_user_id_status_idx" ON "registered_devices"("user_id", "status");
CREATE INDEX "registered_devices_token_hash_idx" ON "registered_devices"("token_hash");
CREATE UNIQUE INDEX "registered_devices_organization_id_device_uid_key" ON "registered_devices"("organization_id", "device_uid");

CREATE INDEX "work_sessions_user_id_status_started_at_idx" ON "work_sessions"("user_id", "status", "started_at");
CREATE INDEX "work_sessions_organization_id_started_at_idx" ON "work_sessions"("organization_id", "started_at");

CREATE INDEX "attendance_events_user_id_occurred_at_device_idx" ON "attendance_events"("user_id", "occurred_at_device");
CREATE INDEX "attendance_events_organization_id_type_occurred_at_device_idx" ON "attendance_events"("organization_id", "type", "occurred_at_device");
CREATE INDEX "attendance_events_work_session_id_idx" ON "attendance_events"("work_session_id");
CREATE UNIQUE INDEX "attendance_events_device_id_client_event_id_key" ON "attendance_events"("device_id", "client_event_id");

CREATE INDEX "heartbeat_events_device_id_received_at_server_idx" ON "heartbeat_events"("device_id", "received_at_server");
CREATE INDEX "heartbeat_events_user_id_received_at_server_idx" ON "heartbeat_events"("user_id", "received_at_server");
CREATE UNIQUE INDEX "heartbeat_events_device_id_client_event_id_key" ON "heartbeat_events"("device_id", "client_event_id");

CREATE INDEX "device_state_intervals_user_id_started_at_idx" ON "device_state_intervals"("user_id", "started_at");
CREATE INDEX "device_state_intervals_device_id_ended_at_idx" ON "device_state_intervals"("device_id", "ended_at");

-- AddForeignKey
ALTER TABLE "registered_devices" ADD CONSTRAINT "registered_devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registered_devices" ADD CONSTRAINT "registered_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "registered_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "registered_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_work_session_id_fkey" FOREIGN KEY ("work_session_id") REFERENCES "work_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "heartbeat_events" ADD CONSTRAINT "heartbeat_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "heartbeat_events" ADD CONSTRAINT "heartbeat_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "heartbeat_events" ADD CONSTRAINT "heartbeat_events_work_session_id_fkey" FOREIGN KEY ("work_session_id") REFERENCES "work_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "device_state_intervals" ADD CONSTRAINT "device_state_intervals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "device_state_intervals" ADD CONSTRAINT "device_state_intervals_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "registered_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "device_state_intervals" ADD CONSTRAINT "device_state_intervals_work_session_id_fkey" FOREIGN KEY ("work_session_id") REFERENCES "work_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
