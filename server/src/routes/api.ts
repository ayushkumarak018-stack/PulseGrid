import { Router, Request, Response } from 'express';
import { db } from '../database/db.js';
import { simulator } from '../simulator/sensorSimulator.js';
import { ENV } from '../config/env.js';
import { z } from 'zod';

const router = Router();

// Zod schema for sensor event ingestion
const ingestSchema = z.object({
  device_id: z.string().min(1),
  location: z.string().min(1),
  temperature: z.number(),
  humidity: z.number(),
  pm25: z.number(),
  battery: z.number().int().min(0).max(100),
  status: z.enum(['normal', 'warning', 'critical']).optional()
});

// System Status & DB info
router.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    system: 'PulseGrid IoT Streaming Backend',
    version: '1.0.0',
    database: db.getStatus(),
    timestamp: new Date().toISOString()
  });
});

// Get Sensor Events with query filters
router.get('/events', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const deviceId = req.query.device_id as string | undefined;
    const status = req.query.status as string | undefined;

    const events = await db.getEvents(limit, deviceId, status);
    res.json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ingest Sensor Event (REST API)
router.post('/events', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (ENV.INGEST_API_KEY && apiKey !== ENV.INGEST_API_KEY) {
      // For developer friendliness during demo, we allow if key matches or demo mode is active
      if (!ENV.DEMO_MODE && apiKey !== ENV.INGEST_API_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });
      }
    }

    const validation = ingestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.format() });
    }

    const body = validation.data;
    const event = {
      event_id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      device_id: body.device_id,
      location: body.location,
      temperature: body.temperature,
      humidity: body.humidity,
      pm25: body.pm25,
      battery: body.battery,
      status: body.status || (body.temperature > 40 ? 'critical' : body.temperature > 35 ? 'warning' : 'normal'),
      recorded_at: new Date().toISOString()
    };

    await db.insertEvent(event);
    simulator.broadcast(event);

    res.status(201).json({ success: true, data: event });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Analytics Summary
router.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    const summary = await db.getAnalyticsSummary();
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Timeseries Data for Charts
router.get('/analytics/timeseries', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
    const data = await db.getTimeSeriesData(limit);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Device Status List
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const devices = await db.getDeviceStats();
    res.json({ success: true, data: devices });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Server-Sent Events (SSE) Live Feed endpoint
router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connection acknowledgment
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Connected to PulseGrid Live Stream' })}\n\n`);

  const clientId = simulator.addClient(res);

  req.on('close', () => {
    simulator.removeClient(clientId);
  });
});

// Simulator Control
router.post('/simulator/start', (req: Request, res: Response) => {
  simulator.start();
  res.json({ success: true, message: 'Simulator started' });
});

router.post('/simulator/stop', (req: Request, res: Response) => {
  simulator.stop();
  res.json({ success: true, message: 'Simulator stopped' });
});

// Custom SQL Query Execution
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }
    const rows = await db.query(query);
    res.json({ success: true, rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
