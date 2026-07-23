/**
 * 유효성 검증 실패 시, 어떤 필드가 왜 잘못되었는지를 설명하는 항목입니다.
 * RFC 7807 의 확장 멤버(`errors`)를 구성하는 요소로 사용됩니다.
 * @see https://datatracker.ietf.org/doc/html/rfc7807#section-3.2
 */
export interface InvalidParam {
  /** 문제가 발생한 필드 경로입니다. (예: `user.email`, `items.0.qty`) */
  name: string;

  /** 사람이 읽을 수 있는 실패 사유입니다. */
  reason: string;

  /** 클라이언트가 분기 처리할 수 있는 기계 판독용 코드입니다. (예: Zod issue code) */
  code?: string;
}

/**
 * RFC 7807 (Problem Details for HTTP APIs) 표준을 따르는 에러 응답 본문입니다.
 * 표준 멤버(type/title/status/detail/instance)에 더해, 서비스 전반에서 일관되게
 * 사용하는 확장 멤버(code/timestamp/traceId/errors)를 정의합니다.
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ProblemDetails {
  /**
   * 문제 유형을 식별하는 URI 입니다. 값이 `about:blank` 이면
   * `title` 은 해당 HTTP 상태 코드의 표준 문구를 의미합니다.
   */
  type: string;

  /** 문제 유형에 대한 짧고 사람이 읽을 수 있는 요약입니다. */
  title: string;

  /** 이 문제 발생에 대한 HTTP 상태 코드입니다. */
  status: number;

  /** 이 문제 발생에 대한 구체적인 설명입니다. */
  detail?: string;

  /** 문제가 발생한 특정 요청을 식별하는 URI (요청 경로)입니다. */
  instance?: string;

  // --- 확장 멤버 (RFC 7807 §3.2) ---

  /** 애플리케이션 고유 에러 코드입니다. (예: `VALIDATION_FAILED`) */
  code?: string;

  /** 에러가 발생한 시각(ISO 8601)입니다. */
  timestamp?: string;

  /** 요청/응답/로그를 상호 연관시키는 추적 ID 입니다. */
  traceId?: string;

  /** 유효성 검증 실패 목록입니다. (검증 에러일 때만 존재) */
  errors?: InvalidParam[];

  /** 그 밖의 확장 멤버를 허용합니다. */
  [key: string]: unknown;
}
