import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'mysql://tripcircle:tripcircle_pass@localhost:3306/tripcircle',
      STORAGE_DRIVER: 'local',
      LOCAL_UPLOAD_DIR: './uploads',
      JWT_ACCESS_SECRET: 'test-jwt-access-secret-32-chars-minimum!',
      JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-32-chars-minimum!',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'test-user',
      SMTP_PASSWORD: 'test-password',
      SMTP_FROM_NAME: 'TripCircle Test',
      SMTP_FROM_EMAIL: 'test@tripcircle.app',
      API_BASE_URL: 'http://localhost:3000',
      APP_PUBLIC_URL: 'http://localhost:8081',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tripcircle/contracts': path.resolve(__dirname, '../../packages/contracts/src'),
    },
  },
});
