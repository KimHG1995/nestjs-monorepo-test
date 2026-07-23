import { Injectable } from '@nestjs/common';

import { SqsClientService } from '@app/sqs-client';

import { TrackActivityDto } from './dto/track-activity.dto';

/**
 * 사용자 활동 이벤트를 SQS에 발행하는 비즈니스 로직을 처리합니다.
 */
@Injectable()
export class ActivityService {
  constructor(private readonly sqsClientService: SqsClientService) {}

  /**
   * 사용자 활동 데이터를 받아 SQS 큐로 전송합니다.
   * @param {TrackActivityDto} activityData 추적할 사용자 활동 데이터
   * @returns {Promise<{ messageId: string }>} 전송된 메시지의 ID를 포함하는 객체
   */
  async trackActivity(
    activityData: TrackActivityDto,
  ): Promise<{ messageId: string }> {
    // 동일한 사용자의 활동이 순서대로 처리되도록 userId를 MessageGroupId로 사용합니다.
    const result = await this.sqsClientService.sendMessage(
      activityData,
      activityData.userId,
    );

    return { messageId: result.MessageId };
  }
}
