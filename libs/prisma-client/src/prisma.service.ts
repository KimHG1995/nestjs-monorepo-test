import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import type { CommonEnv, DatabaseEnv } from '@app/config';

import { PrismaClient } from '../generated/prisma/client';

/**
 * `PrismaClient` 를 NestJS 라이프사이클에 통합한 서비스입니다.
 * 모듈 초기화 시 DB 에 연결하고, 종료 시 연결을 정리합니다.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService<CommonEnv & DatabaseEnv, true>) {
    const databaseUrl = configService.get('DATABASE_URL', { infer: true });
    const nodeEnv = configService.get('NODE_ENV', { infer: true });
    const adapter = new PrismaPg({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5_000,
    });

    super({
      adapter,
      log:
        nodeEnv === 'production'
          ? ['warn', 'error']
          : ['query', 'warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('데이터베이스에 연결되었습니다.');
    } catch (error) {
      const errorTrace = error instanceof Error ? error.stack : String(error);

      this.logger.error('데이터베이스 연결에 실패했습니다.', errorTrace);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
