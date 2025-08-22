import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { ApiServerService } from './api-server.service';
import { TrackActivityDto } from './track-activity.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UseZodGuard } from 'nestjs-zod';

/**
 * 사용자 활동 추적과 관련된 API 엔드포인트를 제공하는 컨트롤러입니다.
 */
@ApiTags('Activity Tracker')
@Controller('activity')
export class ApiServerController {
  constructor(private readonly apiServerService: ApiServerService) {}

  /**
   * 새로운 사용자 활동을 추적하기 위한 엔드포인트입니다.
   * 요청 본문(body)은 Zod 스키마를 통해 유효성이 검사됩니다.
   * @param {TrackActivityDto} trackActivityDto 클라이언트로부터 받은 사용자 활동 데이터
   * @returns {Promise<{ messageId: string }>} 처리 결과로 메시지 ID를 반환합니다.
   */
  @Post('track')
  @ApiOperation({ summary: '새로운 사용자 활동 추적' })
  @ApiResponse({
    status: 201,
    description: '활동이 성공적으로 추적되었습니다.',
  })
  @ApiResponse({ status: 400, description: '잘못된 입력 데이터입니다.' })
  @UseZodGuard('body', TrackActivityDto)
  async trackActivity(@Body() trackActivityDto: TrackActivityDto) {
    return this.apiServerService.trackActivity(trackActivityDto);
  }
}
