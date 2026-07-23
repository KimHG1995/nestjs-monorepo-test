import { randomUUID } from 'crypto';

import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateWidgetDto } from './dto/create-widget.dto';
import { ListWidgetsQueryDto } from './dto/list-widgets.query';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { Widget } from './widget.entity';

/** 페이지네이션이 적용된 목록 응답의 데이터 형태입니다. */
export interface PaginatedWidgets {
  items: Widget[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 위젯 리소스의 비즈니스 로직을 담당하는 서비스입니다.
 * 목업 템플릿이므로 실제 DB 대신 인메모리 `Map` 을 저장소로 사용합니다.
 */
@Injectable()
export class WidgetsService {
  private readonly widgets = new Map<string, Widget>();

  create(dto: CreateWidgetDto): Widget {
    const now = new Date().toISOString();
    const widget: Widget = {
      id: randomUUID(),
      name: dto.name,
      color: dto.color,
      quantity: dto.quantity,
      tags: dto.tags,
      createdAt: now,
      updatedAt: now,
    };
    this.widgets.set(widget.id, widget);
    return widget;
  }

  findAll(query: ListWidgetsQueryDto): PaginatedWidgets {
    const all = Array.from(this.widgets.values())
      .filter((w) => (query.color ? w.color === query.color : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const start = (query.page - 1) * query.limit;
    const items = all.slice(start, start + query.limit);

    return { items, total: all.length, page: query.page, limit: query.limit };
  }

  findOne(id: string): Widget {
    const widget = this.widgets.get(id);
    if (!widget) {
      throw new NotFoundException(`위젯을 찾을 수 없습니다: ${id}`);
    }
    return widget;
  }

  update(id: string, dto: UpdateWidgetDto): Widget {
    const widget = this.findOne(id);
    const updated: Widget = {
      ...widget,
      ...dto,
      updatedAt: new Date().toISOString(),
    };
    this.widgets.set(id, updated);
    return updated;
  }

  remove(id: string): void {
    if (!this.widgets.delete(id)) {
      throw new NotFoundException(`위젯을 찾을 수 없습니다: ${id}`);
    }
  }
}
