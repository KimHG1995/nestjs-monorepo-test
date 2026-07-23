import { Module } from '@nestjs/common';

import { HttpProtocolModule } from '@app/common-utils';
import { TypedConfigModule } from '@app/config';
import { AppLoggerModule } from '@app/logger';
import { SqsClientModule } from '@app/sqs-client';

import { ApiServerController } from './api-server.controller';
import { ApiServerService } from './api-server.service';
import { apiServerEnvSchema } from './config/env';

@Module({
  imports: [
    TypedConfigModule.forRoot(apiServerEnvSchema),
    AppLoggerModule.forRoot(),
    HttpProtocolModule,
    SqsClientModule,
  ],
  controllers: [ApiServerController],
  providers: [ApiServerService],
})
export class ApiServerModule {}
