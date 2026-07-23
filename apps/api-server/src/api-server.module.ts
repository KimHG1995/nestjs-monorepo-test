import { Module } from '@nestjs/common';

import { HttpProtocolModule } from '@app/common-utils';
import { TypedConfigModule } from '@app/config';
import { AppLoggerModule } from '@app/logger';

import { apiServerEnvSchema } from './config/env';
import { ActivityModule } from './modules/activity/activity.module';

@Module({
  imports: [
    TypedConfigModule.forRoot(apiServerEnvSchema),
    AppLoggerModule.forRoot(),
    HttpProtocolModule,
    ActivityModule,
  ],
})
export class ApiServerModule {}
