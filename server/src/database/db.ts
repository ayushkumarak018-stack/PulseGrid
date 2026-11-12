import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { ENV } from '../config/env.js';

export interface SensorEvent {
  event_id: string;
  device_id: string;
  location: string;
  temperature: number;
  humidity: number;
  pm25: number;
  battery: number;
  status: 'normal' | 'warning' | 'critical';
  recorded_at: string;
}

class DatabaseManager {
  private pool: Pool | null = null;
  private isConnected: boolean = false;
  private memoryEvents: SensorEvent[] = [];
  private maxMemoryEvents: number = 5000;

  constructor() {
    if (ENV.DATABASE_URL && !ENV.DEMO_MODE) {
      this.pool = new Pool({
        connectionString: ENV.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // compatible with Tiger Cloud / hosted postgres
      });
    }
  }

  async init() {
    if (!this.pool) {
      console.log('⚡ [Database] Running in In-Memory Demo Mode (No DATABASE_URL configured or DEMO_MODE=true)');
      this.isConnected = false;
      this.seedInitialMemoryEvents();
      return;
    }

    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT NOW()');
        this.isConnected = true;
        console.log('✅ [Database] Connected successfully to Tiger Data / PostgreSQL');

        // Run migration
        await this.runMigrations(client);
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('❌ [Database] Failed to connect to Tiger Data:', err.message);
      console.log('⚠️ [Database] Falling back to In-Memory Demo Mode gracefully.');
      this.isConnected = false;
      this.pool = null;
      this.seedInitialMemoryEvents();
    }
  }

  private async runMigrations(client: any) {
    try {
      // Look for migration file
      const migrationPath = path.resolve(process.cwd(), '../database/migrations/001_create_sensor_events.sql');
      if (fs.existsSync(migrationPath)) {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await client.query(sql);
        console.log('📦 [Database] Migrations executed successfully.');
      } else {
        // Fallback inline migration
        await client.query(`
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
        `);
        console.log('📦 [Database] Inline table migration verified.');
      }
    } catch (err: any) {
      console.warn('⚠️ [Database] Migration notice (hypertable might already exist or need extension):', err.message);
    }
  }

  private seedInitialMemoryEvents() {
    const devices = [
      { id: 'SENSOR-001', loc: 'Factory North' },
      { id: 'SENSOR-002', loc: 'Factory South' },
      { id: 'SENSOR-003', loc: 'Warehouse A' },
      { id: 'SENSOR-004', loc: 'Warehouse B' },
      { id: 'SENSOR-005', loc: 'Research Lab' }
    ];

    const now = Date.now();
    for (let i = 0; i < 100; i++) {
      const d = devices[i % devices.length];
      const temp = 22 + Math.random() * 15;
      const hum = 40 + Math.random() * 30;
      const pm = 10 + Math.random() * 40;
      const battery = Math.floor(50 + Math.random() * 50);
      const status = temp > 35 || pm > 75 ? 'warning' : temp > 40 || pm > 150 ? 'critical' : 'normal';

      this.memoryEvents.unshift({
        event_id: `demo-id-${i}-${Math.random().toString(36).substring(2, 7)}`,
        device_id: d.id,
        location: d.loc,
        temperature: Number(temp.toFixed(2)),
        humidity: Number(hum.toFixed(2)),
        pm25: Number(pm.toFixed(2)),
        battery,
        status: status as any,
        recorded_at: new Date(now - (100 - i) * 1000).toISOString()
      });
    }
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      mode: this.isConnected ? 'Tiger Data (PostgreSQL / TimescaleDB)' : 'In-Memory Demo Mode',
      poolActive: !!this.pool
    };
  }

  async insertEvent(event: SensorEvent): Promise<void> {
    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `INSERT INTO iot_sensor_events (event_id, device_id, location, temperature, humidity, pm25, battery, status, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            event.event_id,
            event.device_id,
            event.location,
            event.temperature,
            event.humidity,
            event.pm25,
            event.battery,
            event.status,
            event.recorded_at
          ]
        );
        return;
      } catch (err) {
        console.error('Database insert error, pushing to memory cache:', err);
      }
    }

    // Memory fallback
    this.memoryEvents.unshift(event);
    if (this.memoryEvents.length > this.maxMemoryEvents) {
      this.memoryEvents.pop();
    }
  }

  async getEvents(limit = 50, deviceId?: string, status?: string): Promise<SensorEvent[]> {
    if (this.pool && this.isConnected) {
      try {
        let query = `SELECT * FROM iot_sensor_events WHERE 1=1`;
        const params: any[] = [];
        let idx = 1;

        if (deviceId) {
          query += ` AND device_id = $${idx++}`;
          params.push(deviceId);
        }
        if (status) {
          query += ` AND status = $${idx++}`;
          params.push(status);
        }

        query += ` ORDER BY recorded_at DESC LIMIT $${idx}`;
        params.push(limit);

        const res = await this.pool.query(query, params);
        return res.rows.map(row => ({
          ...row,
          recorded_at: new Date(row.recorded_at).toISOString()
        }));
      } catch (err) {
        console.error('Database query error, using memory fallback:', err);
      }
    }

    // Memory query
    let filtered = [...this.memoryEvents];
    if (deviceId) {
      filtered = filtered.filter(e => e.device_id === deviceId);
    }
    if (status) {
      filtered = filtered.filter(e => e.status === status);
    }
    return filtered.slice(0, limit);
  }

  async getAnalyticsSummary() {
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(`
          SELECT
            COUNT(*) as total_events,
            COALESCE(AVG(temperature), 0) as avg_temperature,
            COALESCE(AVG(humidity), 0) as avg_humidity,
            COALESCE(AVG(pm25), 0) as avg_pm25,
            COUNT(DISTINCT device_id) as active_devices,
            COUNT(CASE WHEN status = 'critical' THEN 1 END) as critical_count,
            COUNT(CASE WHEN status = 'warning' THEN 1 END) as warning_count,
            COUNT(CASE WHEN status = 'normal' THEN 1 END) as normal_count
          FROM iot_sensor_events
          WHERE recorded_at >= NOW() - INTERVAL '24 hours'
        `);
        const row = res.rows[0];
        return {
          totalEvents: Number(row.total_events),
          avgTemperature: Number(Number(row.avg_temperature).toFixed(2)),
          avgHumidity: Number(Number(row.avg_humidity).toFixed(2)),
          avgPm25: Number(Number(row.avg_pm25).toFixed(2)),
          activeDevices: Number(row.active_devices),
          criticalCount: Number(row.critical_count),
          warningCount: Number(row.warning_count),
          normalCount: Number(row.normal_count)
        };
      } catch (err) {
        console.error('Analytics summary DB error:', err);
      }
    }

    // Memory summary
    const events = this.memoryEvents;
    const totalEvents = events.length;
    const avgTemp = totalEvents ? events.reduce((acc, e) => acc + e.temperature, 0) / totalEvents : 0;
    const avgHum = totalEvents ? events.reduce((acc, e) => acc + e.humidity, 0) / totalEvents : 0;
    const avgPm = totalEvents ? events.reduce((acc, e) => acc + e.pm25, 0) / totalEvents : 0;
    const activeDevices = new Set(events.map(e => e.device_id)).size;
    const criticalCount = events.filter(e => e.status === 'critical').length;
    const warningCount = events.filter(e => e.status === 'warning').length;
    const normalCount = events.filter(e => e.status === 'normal').length;

    return {
      totalEvents,
      avgTemperature: Number(avgTemp.toFixed(2)),
      avgHumidity: Number(avgHum.toFixed(2)),
      avgPm25: Number(avgPm.toFixed(2)),
      activeDevices,
      criticalCount,
      warningCount,
      normalCount
    };
  }

  async getTimeSeriesData(limit = 30) {
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(`
          SELECT
            TO_CHAR(recorded_at, 'HH24:MI:SS') as time_label,
            AVG(temperature) as temperature,
            AVG(humidity) as humidity,
            AVG(pm25) as pm25
          FROM iot_sensor_events
          GROUP BY time_label, recorded_at
          ORDER BY recorded_at DESC
          LIMIT $1
        `, [limit]);
        return res.rows.reverse().map(r => ({
          time_label: r.time_label,
          temperature: Number(Number(r.temperature).toFixed(2)),
          humidity: Number(Number(r.humidity).toFixed(2)),
          pm25: Number(Number(r.pm25).toFixed(2))
        }));
      } catch (err) {
        console.error('Timeseries DB error:', err);
      }
    }

    // Memory timeseries
    return this.memoryEvents.slice(0, limit).reverse().map(e => ({
      time_label: new Date(e.recorded_at).toLocaleTimeString(),
      temperature: e.temperature,
      humidity: e.humidity,
      pm25: e.pm25
    }));
  }

  async query(sql: string): Promise<any[]> {
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(sql);
        return res.rows;
      } catch (err: any) {
        throw new Error(err.message);
      }
    }

    // In-Memory simulated query results
    return this.memoryEvents.slice(0, 15).map(e => ({
      device_id: e.device_id,
      location: e.location,
      temperature: e.temperature,
      humidity: e.humidity,
      pm25: e.pm25,
      battery: e.battery,
      status: e.status,
      recorded_at: e.recorded_at
    }));
  }

  async getDeviceStats() {
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(`
          SELECT DISTINCT ON (device_id)
            device_id,
            location,
            temperature,
            humidity,
            pm25,
            battery,
            status,
            recorded_at
          FROM iot_sensor_events
          ORDER BY device_id, recorded_at DESC
        `);
        return res.rows;
      } catch (err) {
        console.error('Device stats DB error:', err);
      }
    }

    // Memory device stats
    const map = new Map<string, SensorEvent>();
    for (const e of this.memoryEvents) {
      if (!map.has(e.device_id)) {
        map.set(e.device_id, e);
      }
    }
    return Array.from(map.values());
  }
}

export const db = new DatabaseManager();
