import { Module } from '@nestjs/common';

import { SqsClientModule } from '@app/sqs-client';

import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Module({
  imports: [SqsClientModule],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
