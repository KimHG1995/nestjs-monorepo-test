/**
 * 모든 정상(2xx) 응답에 공통으로 포함되는 메타데이터입니다.
 */
export interface ResponseMeta {
  /** 응답 생성 시각(ISO 8601)입니다. */
  timestamp: string;

  /** 요청 경로입니다. */
  path: string;

  /** 요청/응답/로그를 상호 연관시키는 추적 ID 입니다. */
  traceId?: string;
}

/**
 * 정형화된 성공 응답 봉투(envelope)입니다.
 * 모든 성공 응답은 `ResponseTransformInterceptor` 를 거쳐 이 형태로 반환됩니다.
 *
 * ```json
 * { "success": true, "data": { ... }, "meta": { ... } }
 * ```
 *
 * 실패 응답은 이 봉투를 사용하지 않고 RFC 7807 `ProblemDetails` 형태로 반환됩니다.
 */
export interface ApiResponse<T> {
  /** 성공 응답임을 나타내는 판별자입니다. 항상 `true` 입니다. */
  success: true;

  /** 실제 응답 데이터입니다. */
  data: T;

  /** 응답 메타데이터입니다. */
  meta: ResponseMeta;
}
