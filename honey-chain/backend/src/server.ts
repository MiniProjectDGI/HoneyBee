import 'dotenv/config';
import { createApp } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { blockchainService } from './blockchain/blockchainService';
import { logger } from './utils/logger';

async function bootstrap() {
  logger.info('Starting Honey Chain API Server...');

  // Connect database
  try {
    await connectDatabase();
  } catch (err) {
    logger.warn('Database connection failed — API running in offline/unconnected mode until DB is available', { err });
  }

  // Initialize blockchain service (non-blocking — continues if unavailable)
  try {
    await blockchainService.initialize();
  } catch (err) {
    logger.warn('Blockchain initialization failed — continuing without blockchain', { err });
  }

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`Honey Chain API running`, {
      port: config.port,
      env: config.env,
      docs: `http://localhost:${config.port}/api/docs`,
    });
  });

  // Graceful shutdown
  async function shutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      logger.info('Server shutdown complete');
      process.exit(0);
    });

    // Force exit after 30s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
