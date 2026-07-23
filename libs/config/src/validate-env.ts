import type { ZodType } from 'zod';

/**
 * Zod 스키마로부터 `@nestjs/config` 의 `validate` 함수를 생성합니다.
 *
 * 애플리케이션 부팅 시점에 `process.env` 를 검증하여,
 * - 검증에 성공하면 파싱·기본값·형변환이 적용된 **타입 세이프한** 객체를 반환하고,
 * - 실패하면 어떤 변수가 왜 잘못되었는지 정리한 에러로 **즉시 부팅을 중단**(fail-fast)합니다.
 */
export function createEnvValidator<T>(schema: ZodType<T>) {
  return (config: Record<string, unknown>): T => {
    const result = schema.safeParse(config);

    if (!result.success) {
      const issues = result.error.issues
        .map(
          (issue) =>
            `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
        )
        .join('\n');
      throw new Error(`환경변수 검증에 실패했습니다.\n${issues}`);
    }

    return result.data;
  };
}
