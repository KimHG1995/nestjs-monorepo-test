import { Module } from '@nestjs/common';

import { TypedConfigModule } from '@app/config';
import { AppLoggerModule } from '@app/logger';

import { activityWorkerEnvSchema } from './config/env';
import { ActivityConsumerModule } from './modules/activity-consumer/activity-consumer.module';

@Module({
  imports: [
    TypedConfigModule.forRoot(activityWorkerEnvSchema),
    AppLoggerModule.forRoot(),
    ActivityConsumerModule,
  ],
})
export class ActivityWorkerModule {}
