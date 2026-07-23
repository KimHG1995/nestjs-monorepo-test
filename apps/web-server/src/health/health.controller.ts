import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { SkipResponseTransform } from '@app/common-utils';

/**
 * 헬스체크 엔드포인트입니다. 로드밸런서/오케스트레이터가 소비하는 규격이므로
 * 성공 봉투로 감싸지 않고(`@SkipResponseTransform`) 단순한 형태를 반환합니다.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @SkipResponseTransform()
  @ApiOperation({ summary: '헬스체크' })
  check() {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
