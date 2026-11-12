import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  INGEST_API_KEY: process.env.INGEST_API_KEY || 'pulsegrid-secret-key',
  DEMO_MODE: process.env.DEMO_MODE === 'true' || !process.env.DATABASE_URL,
};
