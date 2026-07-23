import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { SkipResponseTransform } from '@app/common-utils';

import { CreateWidgetDto } from './dto/create-widget.dto';
import { ListWidgetsQueryDto } from './dto/list-widgets.query';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { WidgetsService } from './widgets.service';

/**
 * 표준 통신 프로토콜을 그대로 보여주는 예시 리소스 컨트롤러입니다.
 * - 요청: 전역 `ZodValidationPipe` 로 검증 (실패 시 RFC 7807 로 정형화)
 * - 성공 응답: 전역 인터셉터가 `{ success, data, meta }` 봉투로 정형화
 * - 실패 응답: 전역 필터가 `application/problem+json` 으로 정형화
 */
@ApiTags('Widgets')
@Controller('widgets')
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Post()
  @ApiOperation({ summary: '위젯 생성' })
  @ApiResponse({ status: 201, description: '위젯이 생성되었습니다.' })
  @ApiResponse({ status: 400, description: '요청 검증 실패 (RFC 7807).' })
  create(@Body() dto: CreateWidgetDto) {
    return this.widgetsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '위젯 목록 조회 (페이지네이션)' })
  @ApiResponse({ status: 200, description: '위젯 목록.' })
  findAll(@Query() query: ListWidgetsQueryDto) {
    return this.widgetsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '위젯 단건 조회' })
  @ApiParam({ name: 'id', description: '위젯 ID' })
  @ApiResponse({ status: 200, description: '위젯.' })
  @ApiResponse({ status: 404, description: '위젯을 찾을 수 없음 (RFC 7807).' })
  findOne(@Param('id') id: string) {
    return this.widgetsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '위젯 부분 수정' })
  @ApiParam({ name: 'id', description: '위젯 ID' })
  @ApiResponse({ status: 200, description: '수정된 위젯.' })
  @ApiResponse({ status: 404, description: '위젯을 찾을 수 없음 (RFC 7807).' })
  update(@Param('id') id: string, @Body() dto: UpdateWidgetDto) {
    return this.widgetsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // 204 No Content 는 본문을 가질 수 없으므로 성공 봉투 정형화를 건너뜁니다.
  @SkipResponseTransform()
  @ApiOperation({ summary: '위젯 삭제' })
  @ApiParam({ name: 'id', description: '위젯 ID' })
  @ApiResponse({ status: 204, description: '삭제 완료 (본문 없음).' })
  @ApiResponse({ status: 404, description: '위젯을 찾을 수 없음 (RFC 7807).' })
  remove(@Param('id') id: string): void {
    this.widgetsService.remove(id);
  }
}
