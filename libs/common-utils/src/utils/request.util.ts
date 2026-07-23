import { randomUUID } from 'crypto';

import type { Request } from 'express';

import { TRACE_ID_HEADER } from '../constants';

/**
 * 요청에서 추적 ID(traceId)를 추출합니다.
 *
 * 우선순위:
 * 1. `pino-http` 등이 부여한 `req.id`
 * 2. `x-request-id` 요청 헤더
 * 3. 위 두 값이 모두 없으면 새 UUID 를 생성
 *
 * 이렇게 얻은 값으로 성공 응답의 `meta.traceId`, 에러 응답의 `traceId`,
 * 그리고 로그가 동일한 식별자를 공유하게 됩니다.
 */
export function resolveTraceId(request: Request | undefined): string {
  if (!request) {
    return randomUUID();
  }

  const reqId = (request as Request & { id?: string | number }).id;
  if (reqId !== undefined && reqId !== null && reqId !== '') {
    return String(reqId);
  }

  const headerId = request.headers?.[TRACE_ID_HEADER];
  if (typeof headerId === 'string' && headerId.length > 0) {
    return headerId;
  }
  if (Array.isArray(headerId) && headerId.length > 0) {
    return headerId[0];
  }

  return randomUUID();
}
