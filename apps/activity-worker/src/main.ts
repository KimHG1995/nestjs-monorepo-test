import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { Logger } from '@app/logger';

import { ActivityWorkerModule } from './activity-worker.module';

async function bootstrap() {
  // 워커는 HTTP 서버가 필요 없으므로 애플리케이션 컨텍스트만 생성합니다.
  const app = await NestFactory.createApplicationContext(ActivityWorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  new NestLogger('Bootstrap').log('activity-worker 가 실행 중입니다.');
}
void bootstrap();
