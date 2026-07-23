import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { ResponseTransformInterceptor } from './interceptors/response-transform.interceptor';

/**
 * 표준 HTTP 통신 프로토콜을 하나의 일관된 파이프라인으로 묶어 전역 적용하는 모듈입니다.
 * HTTP 앱의 루트 모듈에서 `imports: [HttpProtocolModule]` 하면 다음이 전역으로 활성화됩니다.
 *
 * 1. `ZodValidationPipe`             — 모든 요청 DTO 를 Zod 스키마로 검증 (요청 정형화)
 * 2. `ResponseTransformInterceptor`  — 성공 응답을 `{ success, data, meta }` 봉투로 정형화
 * 3. `AllExceptionsFilter`           — 모든 에러를 RFC 7807 `problem+json` 으로 정형화
 *
 * 각 앱이 `main.ts` 에서 필터/인터셉터를 개별적으로 `useGlobal*` 로 등록하지 않아도
 * 되도록, DI 가 가능한 `APP_*` 토큰으로 제공합니다.
 */
@Module({
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class HttpProtocolModule {}
