import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AnalyticsService } from './analytics.service';
import { FunnelQueryDto } from './dto/funnel-query.dto';

@ApiTags('Admin Analytics')
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('funnel')
  @ApiOperation({ summary: '상품별 사용자 전환 퍼널 조회' })
  @ApiResponse({
    status: 200,
    description: '조회 기간 내 상품 퍼널 지표.',
  })
  @ApiResponse({ status: 404, description: '존재하지 않는 상품.' })
  getProductFunnel(@Query() query: FunnelQueryDto) {
    return this.analyticsService.getProductFunnel(query);
  }
}
