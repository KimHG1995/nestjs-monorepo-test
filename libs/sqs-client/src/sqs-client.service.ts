import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * AWS SQS와 상호작용하여 메시지를 보내고, 받고, 삭제하는 기능을 제공하는 서비스입니다.
 * FIFO 큐 사용에 최적화되어 있습니다.
 */
@Injectable()
export class SqsClientService implements OnModuleInit {
  private readonly sqsClient: SQSClient;
  // LocalStack 또는 모의 URL
  private readonly queueUrl =
    'http://localhost:4566/000000000000/user-activity.fifo';

  constructor() {
    // 실제 애플리케이션에서는 이 값들을 설정 서비스에서 가져와야 합니다.
    this.sqsClient = new SQSClient({
      region: 'us-east-1',
      endpoint: 'http://localhost:4566', // LocalStack을 사용한 로컬 개발용 엔드포인트
      credentials: {
        accessKeyId: 'test', // 로컬 개발용 더미 자격증명
        secretAccessKey: 'test',
      },
    });
  }

  /**
   * 모듈이 초기화될 때 호출됩니다.
   * SQS 클라이언트가 초기화되었음을 로그로 남깁니다.
   */
  onModuleInit() {
    console.log(
      'SQS 클라이언트가 FIFO 큐에 대해 초기화되었습니다:',
      this.queueUrl,
    );
  }

  /**
   * SQS FIFO 큐로 메시지를 보냅니다.
   * @template T 메시지 본문의 타입 (객체 형태)
   * @param {T} body 전송할 메시지의 본문
   * @param {string} messageGroupId 메시지 그룹 ID. 동일한 그룹 ID의 메시지는 순서대로 처리됩니다.
   * @returns {Promise<import('@aws-sdk/client-sqs').SendMessageCommandOutput>} SQS에서 반환된 결과
   */
  async sendMessage<T extends Record<string, any>>(
    body: T,
    messageGroupId: string,
  ): Promise<import('@aws-sdk/client-sqs').SendMessageCommandOutput> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(body),
      MessageGroupId: messageGroupId,
      // MessageDeduplicationId는 보통 콘텐츠 해시나 고유 ID를 기반으로 생성됩니다.
      // 큐에서 ContentBasedDeduplication이 활성화된 경우 SQS가 자동으로 생성해줍니다.
      MessageDeduplicationId: randomUUID(),
    });

    try {
      const data = await this.sqsClient.send(command);
      console.log(
        `메시지가 SQS FIFO 큐로 전송되었습니다, ID: ${data.MessageId}`,
      );
      return data;
    } catch (error) {
      console.error('SQS로 메시지 전송 중 오류 발생:', error);
      throw error;
    }
  }

  /**
   * SQS 큐에서 메시지를 수신합니다. 롱 폴링을 사용하여 효율적으로 메시지를 기다립니다.
   * @param {number} [maxNumberOfMessages=10] 한 번에 수신할 최대 메시지 수
   * @returns {Promise<Message[]>} 수신된 메시지 배열
   */
  async receiveMessages(maxNumberOfMessages: number = 10): Promise<Message[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: maxNumberOfMessages,
      WaitTimeSeconds: 20, // 롱 폴링
      VisibilityTimeout: 30,
    });

    try {
      const data = await this.sqsClient.send(command);
      return data.Messages || [];
    } catch (error) {
      console.error('SQS에서 메시지 수신 중 오류 발생:', error);
      return [];
    }
  }

  /**
   * SQS 큐에서 특정 메시지를 삭제합니다. 메시지 처리가 성공적으로 완료된 후 호출해야 합니다.
   * @param {string} receiptHandle 삭제할 메시지의 수신 핸들
   * @returns {Promise<void>}
   */
  async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });

    try {
      await this.sqsClient.send(command);
    } catch (error) {
      console.error('SQS에서 메시지 삭제 중 오류 발생:', error);
      throw error;
    }
  }
}
