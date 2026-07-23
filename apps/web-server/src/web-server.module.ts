import { Module } from '@nestjs/common';

import { HttpProtocolModule } from '@app/common-utils';
import { TypedConfigModule } from '@app/config';
import { AppLoggerModule } from '@app/logger';
import { PrismaModule } from '@app/prisma-client';

import { AnalyticsModule } from './admin/analytics/analytics.module';
import { webServerEnvSchema } from './config/env';
import { HealthController } from './health/health.controller';
import { ProductsModule } from './products/products.module';

/**
 * web-server 루트 모듈입니다.
 * - `TypedConfigModule` : Zod 로 환경변수를 검증·주입 (전역)
 * - `AppLoggerModule`   : pino 구조화 로깅 (요청 추적 ID 포함)
 * - `HttpProtocolModule`: 표준 통신 프로토콜(검증 파이프 + 응답 봉투 + RFC7807 필터)
 * - `PrismaModule`      : PostgreSQL 연결 및 Prisma 클라이언트 제공
 */
@Module({
  imports: [
    TypedConfigModule.forRoot(webServerEnvSchema),
    AppLoggerModule.forRoot(),
    HttpProtocolModule,
    PrismaModule,
    ProductsModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class WebServerModule {}
