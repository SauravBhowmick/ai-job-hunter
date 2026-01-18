import { z } from 'zod';

const envSchema = z.object({
  VITE_APP_ID: z.string().min(1, 'VITE_APP_ID is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  OAUTH_SERVER_URL: z.string().url('OAUTH_SERVER_URL must be a valid URL'),
  OWNER_OPEN_ID: z.string().min(1, 'OWNER_OPEN_ID is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  BUILT_IN_FORGE_API_URL: z.string().url().optional(),
  BUILT_IN_FORGE_API_KEY: z.string().optional(),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parseResult.error.flatten().fieldErrors);
  process.exit(1);
}

export const ENV = {
  appId: parseResult.data.VITE_APP_ID,
  cookieSecret: parseResult.data.JWT_SECRET,
  databaseUrl: parseResult.data.DATABASE_URL,
  oAuthServerUrl: parseResult.data.OAUTH_SERVER_URL,
  ownerOpenId: parseResult.data.OWNER_OPEN_ID,
  isProduction: parseResult.data.NODE_ENV === 'production',
  forgeApiUrl: parseResult.data.BUILT_IN_FORGE_API_URL ?? '',
  forgeApiKey: parseResult.data.BUILT_IN_FORGE_API_KEY ?? '',
};

