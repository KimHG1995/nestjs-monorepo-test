import { createZodDto } from 'nestjs-zod';

import { ActivityEventSchema } from '@app/common-utils';

/**
 * Zod 스키마로부터 생성된 데이터 전송 객체(DTO) 클래스입니다.
 * `nestjs-zod`를 통해 들어오는 요청의 유효성을 검사하는 데 사용됩니다.
 */
export class TrackActivityDto extends createZodDto(ActivityEventSchema) {}
