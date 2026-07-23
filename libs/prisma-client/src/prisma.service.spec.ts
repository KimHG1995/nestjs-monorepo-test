import { ConfigService } from '@nestjs/config';

import type { CommonEnv, DatabaseEnv } from '@app/config';

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('검증된 데이터베이스 URL로 Prisma Client를 생성한다', async () => {
    const configService = new ConfigService<CommonEnv & DatabaseEnv, true>({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5432/app?schema=public',
    });

    const service = new PrismaService(configService);

    expect(service.userActivity).toBeDefined();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
