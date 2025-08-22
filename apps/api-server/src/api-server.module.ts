import { Module } from '@nestjs/common';
import { ApiServerController } from './api-server.controller';
import { ApiServerService } from './api-server.service';
import { SqsClientModule } from '@app/sqs-client';

@Module({
  imports: [SqsClientModule],
  controllers: [ApiServerController],
  providers: [ApiServerService],
})
export class ApiServerModule {}
