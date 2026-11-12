import { db, SensorEvent } from '../database/db.js';

type SSEClient = {
  id: string;
  res: any;
};

class SensorSimulator {
  private clients: SSEClient[] = [];
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private intervalMs: number = 2000; // Generate events every 2 seconds

  private devices = [
    { id: 'SENSOR-001', location: 'Factory North Line 1' },
    { id: 'SENSOR-002', location: 'Factory South Assembly' },
    { id: 'SENSOR-003', location: 'Warehouse A Cold Storage' },
    { id: 'SENSOR-004', location: 'Warehouse B Logistics' },
    { id: 'SENSOR-005', location: 'Research & Dev Cleanroom' },
    { id: 'SENSOR-006', location: 'Data Center HVAC Zone' }
  ];

  public addClient(res: any): string {
    const id = Math.random().toString(36).substring(2, 9);
    this.clients.push({ id, res });
    return id;
  }

  public removeClient(id: string) {
    this.clients = this.clients.filter(c => c.id !== id);
  }

  public broadcast(event: SensorEvent) {
    const data = JSON.stringify(event);
    for (const client of this.clients) {
      client.res.write(`data: ${data}\n\n`);
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🚀 [Simulator] Live IoT Sensor Simulator started (interval: 2s)');

    this.intervalTimer = setInterval(async () => {
      try {
        const device = this.devices[Math.floor(Math.random() * this.devices.length)];

        // Add some realistic fluctuation & random anomaly spikes
        const isAnomaly = Math.random() < 0.12; // 12% chance of warning/critical
        let temp = 24 + Math.random() * 12;
        let hum = 45 + Math.random() * 25;
        let pm25 = 15 + Math.random() * 35;
        let battery = Math.floor(60 + Math.random() * 40);

        let status: 'normal' | 'warning' | 'critical' = 'normal';

        if (isAnomaly) {
          if (Math.random() > 0.5) {
            temp = 42 + Math.random() * 10; // Overheat
            status = 'critical';
          } else {
            pm25 = 110 + Math.random() * 90; // High PM2.5 / Air Quality Alert
            status = 'warning';
          }
        }

        const event: SensorEvent = {
          event_id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          device_id: device.id,
          location: device.location,
          temperature: Number(temp.toFixed(2)),
          humidity: Number(hum.toFixed(2)),
          pm25: Number(pm25.toFixed(2)),
          battery,
          status,
          recorded_at: new Date().toISOString()
        };

        // Save to DB or Memory store
        await db.insertEvent(event);

        // Broadcast to SSE listeners
        this.broadcast(event);
      } catch (err) {
        console.error('❌ [Simulator] Error generating sensor event:', err);
      }
    }, this.intervalMs);
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('🛑 [Simulator] Stopped.');
  }

  public setIntervalMs(ms: number) {
    this.intervalMs = ms;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

export const simulator = new SensorSimulator();
