import { Module } from '@nestjs/common';

import { HttpProtocolModule } from '@app/common-utils';
import { TypedConfigModule } from '@app/config';
import { AppLoggerModule } from '@app/logger';

import { webServerEnvSchema } from './config/env';
import { AnalyticsModule } from './modules/admin/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { ProductsModule } from './modules/products/products.module';

/**
 * web-server 루트 모듈입니다.
 * - `TypedConfigModule` : Zod 로 환경변수를 검증·주입 (전역)
 * - `AppLoggerModule`   : pino 구조화 로깅 (요청 추적 ID 포함)
 * - `HttpProtocolModule`: 표준 통신 프로토콜(검증 파이프 + 응답 봉투 + RFC7807 필터)
 * - 기능 모듈           : 각 도메인의 컨트롤러·서비스·인프라 의존성 캡슐화
 */
@Module({
  imports: [
    TypedConfigModule.forRoot(webServerEnvSchema),
    AppLoggerModule.forRoot(),
    HttpProtocolModule,
    ProductsModule,
    AnalyticsModule,
    HealthModule,
  ],
})
export class WebServerModule {}
