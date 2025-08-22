/**
 * RFC 7807 (Problem Details for HTTP APIs) 표준을 따르는 에러 객체 인터페이스입니다.
 * @see https://tools.ietf.org/html/rfc7807
 */
export interface ProblemDetails {
  /**
   * 문제 유형을 식별하는 URI입니다.
   * 이 URI는 문제에 대한 인간이 읽을 수 있는 문서를 가리킬 수 있습니다.
   */
  type: string;

  /**
   * 문제 유형에 대한 짧고 사람이 읽을 수 있는 요약입니다.
   */
  title: string;

  /**
   * 이 문제 발생에 대한 HTTP 상태 코드입니다.
   */
  status: number;

  /**
   * 이 문제 발생에 대한 구체적인 설명입니다.
   */
  detail?: string | object;

  /**
   * 문제 발생의 특정 인스턴스를 식별하는 URI입니다.
   */
  instance?: string;
}
