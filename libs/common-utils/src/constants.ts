/**
 * 표준 통신 프로토콜에서 사용하는 상수 모음입니다.
 */

/**
 * RFC 7807 `type` 멤버의 기본 베이스 URI입니다.
 * 각 문제 유형은 이 URI 하위 경로로 식별되며, 사람이 읽을 수 있는 문서를 가리키는 것을 권장합니다.
 * 환경변수 `PROBLEM_TYPE_BASE_URI` 로 재정의할 수 있습니다.
 */
export const PROBLEM_TYPE_BASE_URI =
  process.env.PROBLEM_TYPE_BASE_URI ?? 'https://example.com/problems';

/**
 * RFC 7807 에러 응답의 표준 Content-Type 입니다.
 * @see https://datatracker.ietf.org/doc/html/rfc7807#section-3
 */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/**
 * 요청/응답/로그를 상호 연관(correlation)시키기 위한 추적 ID 헤더 이름입니다.
 */
export const TRACE_ID_HEADER = 'x-request-id';
