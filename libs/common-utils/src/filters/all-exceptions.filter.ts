import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import type { ZodIssue } from 'zod';

import { PROBLEM_CONTENT_TYPE } from '../constants';
import {
  InvalidParam,
  ProblemDetails,
} from '../interfaces/problem-details.interface';
import {
  buildProblemDetails,
  problemTitleFor,
} from '../utils/problem-details.factory';
import { resolveTraceId } from '../utils/request.util';

/**
 * 모든 예외를 RFC 7807 `application/problem+json` 형태로 정형화하는 전역 예외 필터입니다.
 * 이것이 "일관된 파이프라인"의 에러 측 절반을 담당합니다. (성공 측은 `ResponseTransformInterceptor`)
 *
 * 처리 규칙:
 * - `ZodValidationException` : 400 + `errors[]`(필드별 사유) 로 검증 실패를 정형화
 * - `HttpException`          : 예외의 상태/메시지를 표준 문제 상세로 변환
 * - 그 외 모든 예외          : 500 (운영 환경에서는 상세 메시지를 숨김)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = resolveTraceId(request);
    const instance = request?.originalUrl ?? request?.url;

    const problem = this.toProblemDetails(exception, { traceId, instance });

    this.log(exception, problem);

    response
      .status(problem.status)
      .setHeader('Content-Type', PROBLEM_CONTENT_TYPE)
      .json(problem);
  }

  private toProblemDetails(
    exception: unknown,
    ctx: { traceId: string; instance?: string },
  ): ProblemDetails {
    // 1) Zod 검증 실패 -> 필드별 사유를 담은 정형화된 검증 에러
    if (exception instanceof ZodValidationException) {
      const issues = exception.getZodError().issues;
      return buildProblemDetails({
        status: HttpStatus.BAD_REQUEST,
        title: problemTitleFor(HttpStatus.BAD_REQUEST),
        detail: '요청 데이터가 유효성 검증을 통과하지 못했습니다.',
        code: 'VALIDATION_FAILED',
        errors: this.mapZodIssues(issues),
        ...ctx,
      });
    }

    // 2) 그 외 NestJS HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return buildProblemDetails({
        status,
        title: problemTitleFor(status),
        detail: this.extractHttpExceptionDetail(exception),
        ...ctx,
      });
    }

    // 3) 예측하지 못한 서버 오류
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const isProd = process.env.NODE_ENV === 'production';
    return buildProblemDetails({
      status,
      title: problemTitleFor(status),
      detail: isProd
        ? '예기치 못한 오류가 발생했습니다.'
        : this.stringifyUnknown(exception),
      ...ctx,
    });
  }

  private mapZodIssues(issues: readonly ZodIssue[]): InvalidParam[] {
    return issues.map((issue) => ({
      name: issue.path.length > 0 ? issue.path.join('.') : '(root)',
      reason: issue.message,
      code: issue.code,
    }));
  }

  private extractHttpExceptionDetail(exception: HttpException): string {
    const res = exception.getResponse();
    if (typeof res === 'string') {
      return res;
    }
    if (res && typeof res === 'object') {
      const message = (res as { message?: unknown }).message;
      if (Array.isArray(message)) {
        return message.map((m) => String(m)).join(', ');
      }
      if (typeof message === 'string') {
        return message;
      }
    }
    return exception.message;
  }

  private stringifyUnknown(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.stack ?? exception.message;
    }
    return typeof exception === 'string'
      ? exception
      : JSON.stringify(exception);
  }

  private log(exception: unknown, problem: ProblemDetails): void {
    const context = `traceId=${problem.traceId} ${problem.status} ${problem.instance ?? ''}`;
    // 5xx 는 서버 오류이므로 error 레벨로, 그 외(4xx)는 warn 레벨로 기록합니다.
    if (problem.status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${problem.title}: ${problem.detail}`, stack, context);
    } else {
      this.logger.warn(`${problem.title}: ${problem.detail} (${context})`);
    }
  }
}
