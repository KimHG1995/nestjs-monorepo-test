import { z } from 'zod';

import { commonEnvSchema, intFromEnv, sqsEnvSchema } from '@app/config';

/**
 * api-server 애플리케이션의 환경변수 스키마입니다.
 * 공통 스키마 + SQS 스키마에 이 앱만의 변수를 더합니다.
 */
export const apiServerEnvSchema = commonEnvSchema.merge(sqsEnvSchema).merge(
  z.object({
    API_SERVER_PORT: intFromEnv(3000),
  }),
);

export type ApiServerEnv = z.infer<typeof apiServerEnvSchema>;
