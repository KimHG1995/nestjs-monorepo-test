import { z } from 'zod';

import {
  boolFromEnv,
  commonEnvSchema,
  databaseEnvSchema,
  sqsEnvSchema,
} from '@app/config';

/**
 * activity-worker 애플리케이션의 환경변수 스키마입니다.
 * 공통 + SQS + 데이터베이스 스키마에 이 워커만의 변수를 더합니다.
 */
export const activityWorkerEnvSchema = commonEnvSchema
  .merge(sqsEnvSchema)
  .merge(databaseEnvSchema)
  .merge(
    z.object({
      /** SQS 폴링 활성화 여부. 테스트 등에서 폴링 루프를 끄고 싶을 때 사용합니다. */
      WORKER_POLLING_ENABLED: boolFromEnv(true),
    }),
  );

export type ActivityWorkerEnv = z.infer<typeof activityWorkerEnvSchema>;
