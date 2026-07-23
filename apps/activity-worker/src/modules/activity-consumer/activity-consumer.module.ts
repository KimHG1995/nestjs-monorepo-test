import { Module } from '@nestjs/common';

import { PrismaModule } from '@app/prisma-client';
import { SqsClientModule } from '@app/sqs-client';

import { ActivityConsumerService } from './activity-consumer.service';

@Module({
  imports: [PrismaModule, SqsClientModule],
  providers: [ActivityConsumerService],
})
export class ActivityConsumerModule {}
