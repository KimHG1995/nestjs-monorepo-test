import { Module } from '@nestjs/common';
import { SqsClientService } from './sqs-client.service';

@Module({
  providers: [SqsClientService],
  exports: [SqsClientService],
})
export class SqsClientModule {}
