CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS iot_sensor_events (
    event_id UUID PRIMARY KEY,
    device_id TEXT NOT NULL,
    location TEXT NOT NULL,
    temperature DOUBLE PRECISION NOT NULL,
    humidity DOUBLE PRECISION NOT NULL,
    pm25 DOUBLE PRECISION NOT NULL,
    battery INTEGER NOT NULL,
    status TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable(
    'iot_sensor_events',
    'recorded_at',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_sensor_device_time
ON iot_sensor_events (device_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_status_time
ON iot_sensor_events (status, recorded_at DESC);
