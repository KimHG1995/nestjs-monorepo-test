import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { SqsClientService } from '@app/sqs-client';
import { Message } from '@aws-sdk/client-sqs';

/**
 * SQS 큐에서 메시지를 주기적으로 폴링하고 처리하는 워커 서비스입니다.
 */
@Injectable()
export class ActivityWorkerService implements OnModuleInit {
  private readonly logger = new Logger(ActivityWorkerService.name);
  private isPolling = true;

  constructor(private readonly sqsClientService: SqsClientService) {}

  /**
   * NestJS 모듈이 초기화될 때 호출되는 라이프사이클 훅입니다.
   * SQS 큐 폴링을 시작합니다.
   */
  onModuleInit() {
    this.logger.log(
      'Activity Worker가 초기화되었습니다. SQS 큐 폴링을 시작합니다...',
    );
    this.startPolling();
  }

  /**
   * SQS 큐를 지속적으로 폴링하여 메시지를 수신하고 처리합니다.
   * @private
   */
  async startPolling() {
    while (this.isPolling) {
      try {
        const messages = await this.sqsClientService.receiveMessages();
        if (messages.length > 0) {
          this.logger.log(
            `SQS에서 ${messages.length}개의 메시지를 수신했습니다.`,
          );
          for (const message of messages) {
            await this.processMessage(message);
          }
        }
      } catch (error) {
        this.logger.error('SQS 큐 폴링 중 오류 발생:', error);
        // 지속적인 오류 발생 시 로그가 너무 많이 쌓이는 것을 방지하기 위해 재시도 전 딜레이를 추가합니다.
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * 단일 SQS 메시지를 처리합니다.
   * 메시지 내용을 파싱하고, 시뮬레이션된 처리 로직을 실행한 후, 큐에서 메시지를 삭제합니다.
   * @param {Message} message 처리할 SQS 메시지 객체
   * @private
   */
  private async processMessage(message: Message) {
    try {
      this.logger.log(`메시지 ID 처리 중: ${message.MessageId}`);
      const body = JSON.parse(message.Body);

      // 처리 로직 시뮬레이션 (예: DB에 저장, 다른 서비스 호출 등)
      this.logger.log('활동 데이터:', body);

      // 처리가 성공하면 큐에서 메시지를 삭제합니다.
      await this.sqsClientService.deleteMessage(message.ReceiptHandle);
      this.logger.log(`메시지 ${message.MessageId}가 처리 후 삭제되었습니다.`);
    } catch (error) {
      this.logger.error(`메시지 ${message.MessageId} 처리 실패:`, error);
      // 메시지는 VisibilityTimeout 이후에 다시 큐에 나타나 재시도할 수 있게 됩니다.
      // 지속적으로 실패하는 메시지를 위해 Dead Letter Queue (DLQ)를 구현하는 것을 고려해야 합니다.
    }
  }

  /**
   * 메시지 폴링을 중지합니다.
   */
  stopPolling() {
    this.isPolling = false;
    this.logger.log('폴링이 중지되었습니다.');
  }
}
