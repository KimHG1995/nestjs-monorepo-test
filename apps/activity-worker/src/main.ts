import { NestFactory } from '@nestjs/core';
import { ActivityWorkerModule } from './activity-worker.module';

async function bootstrap() {
  const app = await NestFactory.create(ActivityWorkerModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
