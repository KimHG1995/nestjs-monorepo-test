import { Module } from '@nestjs/common';

import { TypedConfigModule } from '@app/config';
import { AppLoggerModule } from '@app/logger';
import { PrismaModule } from '@app/prisma-client';
import { SqsClientModule } from '@app/sqs-client';

import { ActivityWorkerService } from './activity-worker.service';
import { activityWorkerEnvSchema } from './config/env';

@Module({
  imports: [
    TypedConfigModule.forRoot(activityWorkerEnvSchema),
    AppLoggerModule.forRoot(),
    PrismaModule,
    SqsClientModule,
  ],
  providers: [ActivityWorkerService],
})
export class ActivityWorkerModule {}
