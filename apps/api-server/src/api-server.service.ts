import { Injectable } from '@nestjs/common';
import { SqsClientService } from '@app/sqs-client';
import { TrackActivityDto } from './track-activity.dto';

/**
 * API 서버의 비즈니스 로직을 처리하는 서비스입니다.
 */
@Injectable()
export class ApiServerService {
  constructor(private readonly sqsClientService: SqsClientService) {}

  /**
   * 사용자 활동 데이터를 받아 SQS 큐로 전송합니다.
   * @param {TrackActivityDto} activityData 추적할 사용자 활동 데이터
   * @returns {Promise<{ messageId: string }>} 전송된 메시지의 ID를 포함하는 객체
   */
  async trackActivity(
    activityData: TrackActivityDto,
  ): Promise<{ messageId: string }> {
    console.log('추적할 활동 수신:', activityData);

    // 동일한 사용자의 활동이 순서대로 처리되도록 userId를 MessageGroupId로 사용합니다.
    const result = await this.sqsClientService.sendMessage(
      activityData,
      activityData.userId,
    );

    return { messageId: result.MessageId };
  }
}
