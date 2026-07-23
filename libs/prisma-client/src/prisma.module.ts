import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * 전역 Prisma 모듈입니다. 한 번 임포트하면 어느 모듈에서든 `PrismaService` 를 주입할 수 있습니다.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
