import { z } from 'zod';

import {
  boolFromEnv,
  commonEnvSchema,
  databaseEnvSchema,
  intFromEnv,
} from '@app/config';

/**
 * web-server 애플리케이션의 환경변수 스키마입니다.
 * 공통 스키마(NODE_ENV, LOG_LEVEL)에 이 앱만의 변수를 더합니다.
 */
export const webServerEnvSchema = commonEnvSchema
  .merge(databaseEnvSchema)
  .merge(
    z.object({
      /** HTTP(S) 리스닝 포트 */
      WEB_SERVER_PORT: intFromEnv(3002),
      /** HTTPS 활성화 여부. true 이면 아래 KEY/CERT 경로가 필요합니다. */
      HTTPS_ENABLED: boolFromEnv(false),
      /** TLS 개인키 파일 경로 (PEM) */
      HTTPS_KEY_PATH: z.string().optional(),
      /** TLS 인증서 파일 경로 (PEM) */
      HTTPS_CERT_PATH: z.string().optional(),
      /** CORS 허용 오리진 (쉼표로 구분, `*` 는 전체 허용) */
      CORS_ORIGIN: z.string().default('*'),
    }),
  );

export type WebServerEnv = z.infer<typeof webServerEnvSchema>;
