import { Module } from '@nestjs/common';

import { HttpProtocolModule } from '@app/common-utils';
import { TypedConfigModule } from '@app/config';
import { AppLoggerModule } from '@app/logger';

import { webServerEnvSchema } from './config/env';
import { HealthController } from './health/health.controller';
import { WidgetsModule } from './widgets/widgets.module';

/**
 * web-server 루트 모듈입니다.
 * - `TypedConfigModule` : Zod 로 환경변수를 검증·주입 (전역)
 * - `AppLoggerModule`   : pino 구조화 로깅 (요청 추적 ID 포함)
 * - `HttpProtocolModule`: 표준 통신 프로토콜(검증 파이프 + 응답 봉투 + RFC7807 필터)
 */
@Module({
  imports: [
    TypedConfigModule.forRoot(webServerEnvSchema),
    AppLoggerModule.forRoot(),
    HttpProtocolModule,
    WidgetsModule,
  ],
  controllers: [HealthController],
})
export class WebServerModule {}
