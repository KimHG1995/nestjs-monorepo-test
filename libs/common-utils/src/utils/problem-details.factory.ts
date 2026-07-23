import { HttpStatus } from '@nestjs/common';

import { PROBLEM_TYPE_BASE_URI } from '../constants';
import {
  InvalidParam,
  ProblemDetails,
} from '../interfaces/problem-details.interface';

/**
 * HTTP 상태 코드로부터 RFC 7807 `type` URI 를 생성합니다.
 * 예) 404 -> `https://example.com/problems/not-found`
 */
export function problemTypeFor(status: number): string {
  const phrase = HttpStatus[status];
  const slug = phrase
    ? phrase.toLowerCase().replace(/_/g, '-')
    : `status-${status}`;
  return `${PROBLEM_TYPE_BASE_URI}/${slug}`;
}

/**
 * 애플리케이션 고유 에러 코드(SCREAMING_SNAKE_CASE)를 생성합니다.
 * 예) 404 -> `NOT_FOUND`
 */
export function problemCodeFor(status: number): string {
  const phrase = HttpStatus[status];
  return phrase ?? `HTTP_${status}`;
}

/**
 * 사람이 읽을 수 있는 상태 문구(title)를 생성합니다.
 * 예) 404 -> `Not Found`
 */
export function problemTitleFor(status: number): string {
  const phrase = HttpStatus[status];
  if (!phrase) return `HTTP ${status}`;
  return phrase
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * 표준 `ProblemDetails` 객체를 일관된 형태로 조립합니다.
 */
export function buildProblemDetails(params: {
  status: number;
  title: string;
  detail?: string;
  instance?: string;
  traceId?: string;
  timestamp?: string;
  code?: string;
  type?: string;
  errors?: InvalidParam[];
}): ProblemDetails {
  const problem: ProblemDetails = {
    type: params.type ?? problemTypeFor(params.status),
    title: params.title,
    status: params.status,
    code: params.code ?? problemCodeFor(params.status),
    timestamp: params.timestamp ?? new Date().toISOString(),
  };

  if (params.detail !== undefined) problem.detail = params.detail;
  if (params.instance !== undefined) problem.instance = params.instance;
  if (params.traceId !== undefined) problem.traceId = params.traceId;
  if (params.errors !== undefined && params.errors.length > 0) {
    problem.errors = params.errors;
  }

  return problem;
}
