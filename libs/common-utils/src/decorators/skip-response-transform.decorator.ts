import { CustomDecorator, SetMetadata } from '@nestjs/common';

/** `@SkipResponseTransform()` 여부를 저장하는 메타데이터 키입니다. */
export const SKIP_RESPONSE_TRANSFORM = 'skipResponseTransform';

/**
 * 핸들러에 이 데코레이터를 붙이면 성공 응답 봉투(`{ success, data, meta }`)로
 * 감싸지 않고 반환값을 그대로 응답합니다.
 *
 * 헬스체크, 파일/스트림 다운로드, 서드파티 콜백 규격 응답 등
 * 정형화 봉투가 오히려 방해가 되는 소수의 엔드포인트에 사용합니다.
 */
export const SkipResponseTransform = (): CustomDecorator =>
  SetMetadata(SKIP_RESPONSE_TRANSFORM, true);
