import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredEnvVars = ['JWT_SECRET'];

// In production, MONGODB_URI is strictly required
if (process.env.NODE_ENV === 'production') {
  requiredEnvVars.push('MONGODB_URI');
}

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`[FATAL] Missing required environment variable: ${envVar}`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devcollab',
  JWT_SECRET: process.env.JWT_SECRET || 'devcollab_fallback_jwt_secret_key_change_me_in_prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax')
};
