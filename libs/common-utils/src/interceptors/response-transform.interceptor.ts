import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SKIP_RESPONSE_TRANSFORM } from '../decorators/skip-response-transform.decorator';
import { ApiResponse } from '../interfaces/api-response.interface';
import { resolveTraceId } from '../utils/request.util';

/**
 * 모든 정상 응답을 정형화된 성공 봉투(`{ success, data, meta }`)로 감싸는 인터셉터입니다.
 * 이것이 "일관된 파이프라인"의 응답 측 절반을 담당합니다. (에러 측은 `AllExceptionsFilter`)
 *
 * `@SkipResponseTransform()` 이 붙은 핸들러는 봉투로 감싸지 않고 원본을 그대로 반환합니다.
 */
@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    // HTTP 컨텍스트가 아니거나(예: 워커) 명시적으로 제외한 핸들러는 원본 그대로 통과시킵니다.
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_TRANSFORM,
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const traceId = resolveTraceId(request);

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          path: request.originalUrl ?? request.url,
          traceId,
        },
      })),
    );
  }
}
