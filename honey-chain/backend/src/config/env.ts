import dotenv from 'dotenv';
dotenv.config();

const env = (key: string, fallback?: string): string => {
  const value = process.env[key] || fallback;
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

const envOptional = (key: string, fallback = ''): string =>
  process.env[key] || fallback;

export const config = {
  env: envOptional('NODE_ENV', 'development'),
  port: parseInt(envOptional('PORT', '4000'), 10),
  
  database: {
    url: env('DATABASE_URL'),
  },

  jwt: {
    secret: env('JWT_SECRET'),
    refreshSecret: env('JWT_REFRESH_SECRET'),
    accessExpiresIn: envOptional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: envOptional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  cors: {
    origin: envOptional('CORS_ORIGIN', 'http://localhost:5173'),
  },

  rateLimit: {
    windowMs: parseInt(envOptional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(envOptional('RATE_LIMIT_MAX', '100'), 10),
    iotMax: parseInt(envOptional('IOT_RATE_LIMIT_MAX', '1000'), 10),
  },

  blockchain: {
    rpcUrl: envOptional('BLOCKCHAIN_RPC_URL', 'http://127.0.0.1:8545'),
    privateKey: envOptional('BLOCKCHAIN_PRIVATE_KEY', ''),
    contractAddress: envOptional('SMART_CONTRACT_ADDRESS', ''),
    networkId: envOptional('BLOCKCHAIN_NETWORK_ID', '31337'),
  },

  ai: {
    serviceUrl: envOptional('AI_SERVICE_URL', ''),
    apiKey: envOptional('AI_SERVICE_API_KEY', ''),
  },

  storage: {
    type: envOptional('STORAGE_TYPE', 'local') as 'local' | 's3',
    localPath: envOptional('STORAGE_LOCAL_PATH', './uploads'),
    endpoint: envOptional('STORAGE_ENDPOINT', ''),
    bucket: envOptional('STORAGE_BUCKET', ''),
    accessKey: envOptional('STORAGE_ACCESS_KEY', ''),
    secretKey: envOptional('STORAGE_SECRET_KEY', ''),
    region: envOptional('STORAGE_REGION', 'ap-south-1'),
  },

  logging: {
    level: envOptional('LOG_LEVEL', 'info'),
  },

  app: {
    baseUrl: envOptional('APP_BASE_URL', 'http://localhost:4000'),
    frontendUrl: envOptional('FRONTEND_URL', 'http://localhost:5173'),
  },
};
