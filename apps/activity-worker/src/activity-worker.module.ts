import { Module } from '@nestjs/common';
import { ActivityWorkerService } from './activity-worker.service';
import { SqsClientModule } from '@app/sqs-client';

@Module({
  imports: [SqsClientModule],
  providers: [ActivityWorkerService],
})
export class ActivityWorkerModule {}
