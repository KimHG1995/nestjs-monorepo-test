import { z } from 'zod';

/** 문자열 환경변수를 정수로 강제 변환하는 Zod 헬퍼입니다. (`z.coerce.number().int()`) */
export const intFromEnv = (defaultValue: number) =>
  z.coerce.number().int().positive().default(defaultValue);

/** `'true'`/`'false'` 문자열을 boolean 으로 변환하는 Zod 헬퍼입니다. */
export const boolFromEnv = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(defaultValue ? 'true' : 'false');

/**
 * 모든 애플리케이션이 공통으로 사용하는 환경변수 스키마입니다.
 * 각 앱은 이 스키마를 `.merge()` 하여 자신만의 변수를 추가합니다.
 */
export const commonEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type CommonEnv = z.infer<typeof commonEnvSchema>;

/**
 * SQS 연동이 필요한 앱(api-server, activity-worker)이 사용하는 환경변수 스키마입니다.
 */
export const sqsEnvSchema = z.object({
  AWS_REGION: z.string().min(1).default('us-east-1'),
  SQS_ENDPOINT: z.string().url().default('http://localhost:4566'),
  SQS_QUEUE_URL: z
    .string()
    .url()
    .default('http://localhost:4566/000000000000/user-activity.fifo'),
  AWS_ACCESS_KEY_ID: z.string().min(1).default('test'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).default('test'),
});

export type SqsEnv = z.infer<typeof sqsEnvSchema>;

/**
 * 데이터베이스(Prisma) 연동이 필요한 앱이 사용하는 환경변수 스키마입니다.
 */
export const databaseEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://postgres:postgres@localhost:5432/app?schema=public'),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
