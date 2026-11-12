import express from 'express';
import cors from 'cors';
import { ENV } from './config/env.js';
import { db } from './database/db.js';
import { simulator } from './simulator/sensorSimulator.js';
import apiRouter from './routes/api.js';

const app = express();

app.use(cors());
app.use(express.json());

// Mount API routes
app.use('/api', apiRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    app: 'PulseGrid IoT Streaming Analytics Platform',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      status: '/api/status',
      events: '/api/events',
      analyticsSummary: '/api/analytics/summary',
      timeseries: '/api/analytics/timeseries',
      devices: '/api/devices',
      stream: '/api/stream'
    }
  });
});

async function startServer() {
  // Initialize Database connection & migrations
  await db.init();

  app.listen(ENV.PORT, () => {
    console.log(`⚡ [Server] PulseGrid backend running on http://localhost:${ENV.PORT}`);

    // Start background simulator
    simulator.start();
  });
}

startServer().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
