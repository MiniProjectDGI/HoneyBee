import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

import { config } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth';
import batchRoutes from './routes/batches';
import hiveRoutes from './routes/hives';
import { deviceRouter, iotRouter } from './routes/devices';
import qualityRoutes from './routes/quality';
import alertRoutes from './routes/alerts';
import marketplaceRoutes from './routes/marketplace';
import adminRoutes from './routes/admin';
import aiRoutes from './routes/ai';
import publicRoutes from './routes/public';

export function createApp() {
  const app = express();

  // ─── Security Headers ────────────────────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // ─── CORS ─────────────────────────────────────────────────────────────────────
  app.use(cors({
    origin: config.cors.origin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-API-Key'],
    credentials: true,
  }));

  // ─── Rate Limiting ────────────────────────────────────────────────────────────
  const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const iotLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.iotMax,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'IoT rate limit exceeded' } },
  });

  // ─── Body Parsing ─────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ─── Request Logging ──────────────────────────────────────────────────────────
  app.use(requestLogger);

  // ─── Static Files (Uploads) ───────────────────────────────────────────────────
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // ─── Swagger Docs ─────────────────────────────────────────────────────────────
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Honey Chain API',
        version: '1.0.0',
        description: 'Honey Chain — Blockchain + AI + IoT Honey Traceability Platform API',
        contact: { name: 'Honey Chain Team' },
      },
      servers: [
        { url: `http://localhost:${config.port}`, description: 'Development' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

  // ─── API Routes ───────────────────────────────────────────────────────────────
  app.use('/api/public', publicRoutes);             // No auth required
  app.use('/api/auth', apiLimiter, authRoutes);
  app.use('/api/batches', apiLimiter, batchRoutes);
  app.use('/api/hives', apiLimiter, hiveRoutes);
  app.use('/api/devices', apiLimiter, deviceRouter);
  app.use('/api/iot', iotLimiter, iotRouter);       // Higher rate limit for IoT
  app.use('/api/quality', apiLimiter, qualityRoutes);
  app.use('/api/alerts', apiLimiter, alertRoutes);
  app.use('/api/marketplace', apiLimiter, marketplaceRoutes);
  app.use('/api/admin', apiLimiter, adminRoutes);
  app.use('/api/ai', apiLimiter, aiRoutes);

  // ─── 404 and Error Handlers ───────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
