import { Message } from '@aws-sdk/client-sqs';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ActivityEventSchema } from '@app/common-utils';
import { PrismaService } from '@app/prisma-client';
import { SqsClientService } from '@app/sqs-client';

import type { ActivityWorkerEnv } from '../../config/env';

/**
 * SQS 큐를 폴링하여 메시지를 수신하고, 유효성 검증 후 데이터베이스에 적재하는 워커입니다.
 */
@Injectable()
export class ActivityConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ActivityConsumerService.name);
  private isPolling = true;

  constructor(
    private readonly sqsClientService: SqsClientService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ActivityWorkerEnv, true>,
  ) {}

  onModuleInit(): void {
    if (!this.config.get('WORKER_POLLING_ENABLED', { infer: true })) {
      this.logger.warn(
        'WORKER_POLLING_ENABLED=false 이므로 폴링을 시작하지 않습니다.',
      );
      return;
    }
    this.logger.log('Activity Worker 초기화 완료. SQS 폴링을 시작합니다...');
    void this.startPolling();
  }

  /** SQS 큐를 지속적으로 폴링하여 메시지를 수신·처리합니다. */
  async startPolling(): Promise<void> {
    while (this.isPolling) {
      try {
        const messages = await this.sqsClientService.receiveMessages();
        if (messages.length > 0) {
          this.logger.log(
            `SQS 에서 ${messages.length}개의 메시지를 수신했습니다.`,
          );
          for (const message of messages) {
            await this.processMessage(message);
          }
        }
      } catch (error) {
        this.logger.error('SQS 폴링 중 오류가 발생했습니다.', error as Error);
        // 지속적 오류 시 로그 폭주를 막기 위해 재시도 전 잠시 대기합니다.
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * 단일 SQS 메시지를 처리합니다. 메시지를 검증하여 DB 에 적재한 뒤 큐에서 삭제합니다.
   * 처리에 실패하면 메시지를 삭제하지 않아 VisibilityTimeout 이후 재시도됩니다.
   */
  async processMessage(message: Message): Promise<void> {
    try {
      this.logger.log(`메시지 처리 중: ${message.MessageId}`);

      const parsed = ActivityEventSchema.safeParse(
        JSON.parse(message.Body ?? '{}'),
      );
      if (!parsed.success) {
        // 스키마에 맞지 않는(복구 불가능한) 메시지는 재시도 대신 폐기합니다.
        this.logger.warn(
          `유효하지 않은 메시지를 폐기합니다: ${message.MessageId} — ${parsed.error.message}`,
        );
        await this.deleteIfPossible(message);
        return;
      }

      const activity = parsed.data;
      const record = await this.prisma.userActivity.create({
        data: {
          userId: activity.userId,
          activityType: activity.activityType,
          productId: activity.productId,
          details: activity.details,
          occurredAt: new Date(activity.timestamp),
        },
      });
      this.logger.log(`활동을 DB 에 적재했습니다. id=${record.id}`);

      await this.deleteIfPossible(message);
    } catch (error) {
      this.logger.error(
        `메시지 처리 실패: ${message.MessageId}. 재시도됩니다.`,
        error as Error,
      );
      // 반복 실패 메시지를 위해 Dead Letter Queue(DLQ) 구성을 권장합니다.
    }
  }

  private async deleteIfPossible(message: Message): Promise<void> {
    if (message.ReceiptHandle) {
      await this.sqsClientService.deleteMessage(message.ReceiptHandle);
    }
  }

  stopPolling(): void {
    this.isPolling = false;
    this.logger.log('폴링이 중지되었습니다.');
  }
}
