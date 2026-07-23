import { randomUUID } from 'crypto';

import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SendMessageCommand,
  SendMessageCommandOutput,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { SqsEnv } from '@app/config';

/**
 * AWS SQS 와 상호작용하여 메시지를 보내고, 받고, 삭제하는 기능을 제공하는 서비스입니다.
 * FIFO 큐 사용에 최적화되어 있으며, 접속 정보는 검증된 설정(ConfigService)에서 주입받습니다.
 */
@Injectable()
export class SqsClientService implements OnModuleInit {
  private readonly logger = new Logger(SqsClientService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string;

  constructor(private readonly config: ConfigService<SqsEnv, true>) {
    this.queueUrl = this.config.get('SQS_QUEUE_URL', { infer: true });
    this.sqsClient = new SQSClient({
      region: this.config.get('AWS_REGION', { infer: true }),
      endpoint: this.config.get('SQS_ENDPOINT', { infer: true }),
      credentials: {
        accessKeyId: this.config.get('AWS_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY', {
          infer: true,
        }),
      },
    });
  }

  onModuleInit(): void {
    this.logger.log(`SQS 클라이언트가 초기화되었습니다: ${this.queueUrl}`);
  }

  /**
   * SQS FIFO 큐로 메시지를 보냅니다.
   * @param body 전송할 메시지의 본문(객체)
   * @param messageGroupId 메시지 그룹 ID. 동일 그룹의 메시지는 순서대로 처리됩니다.
   */
  async sendMessage<T extends Record<string, any>>(
    body: T,
    messageGroupId: string,
  ): Promise<SendMessageCommandOutput> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(body),
      MessageGroupId: messageGroupId,
      MessageDeduplicationId: randomUUID(),
    });

    try {
      const data = await this.sqsClient.send(command);
      this.logger.log(
        `메시지를 SQS FIFO 큐로 전송했습니다. ID: ${data.MessageId}`,
      );
      return data;
    } catch (error) {
      this.logger.error('SQS 메시지 전송 실패', error as Error);
      throw error;
    }
  }

  /**
   * SQS 큐에서 메시지를 수신합니다. 롱 폴링으로 효율적으로 대기합니다.
   * @param maxNumberOfMessages 한 번에 수신할 최대 메시지 수
   */
  async receiveMessages(maxNumberOfMessages = 10): Promise<Message[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: maxNumberOfMessages,
      WaitTimeSeconds: 20,
      VisibilityTimeout: 30,
    });

    try {
      const data = await this.sqsClient.send(command);
      return data.Messages ?? [];
    } catch (error) {
      this.logger.error('SQS 메시지 수신 실패', error as Error);
      return [];
    }
  }

  /**
   * 처리 완료된 메시지를 큐에서 삭제합니다.
   * @param receiptHandle 삭제할 메시지의 수신 핸들
   */
  async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });

    try {
      await this.sqsClient.send(command);
    } catch (error) {
      this.logger.error('SQS 메시지 삭제 실패', error as Error);
      throw error;
    }
  }
}
