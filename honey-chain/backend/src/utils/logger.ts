import winston from 'winston';
import { config } from '../config/env';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return stack
      ? `${timestamp} [${level}]: ${message}\n${stack}${metaStr}`
      : `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: config.logging.level,
  format: config.env === 'production' ? prodFormat : devFormat,
  defaultMeta: { service: 'honeychain-api' },
  transports: [
    new winston.transports.Console(),
    ...(config.env === 'production'
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
});

// Mask sensitive fields before logging
export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 'apiKey', 'privateKey'];
  const result = { ...obj };
  for (const key of sensitiveKeys) {
    if (key in result) {
      result[key] = '[REDACTED]';
    }
  }
  return result;
}
