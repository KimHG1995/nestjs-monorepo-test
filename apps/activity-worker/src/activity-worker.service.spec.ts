import type { Message } from '@aws-sdk/client-sqs';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { PrismaService } from '@app/prisma-client';
import { SqsClientService } from '@app/sqs-client';

import { ActivityWorkerService } from './activity-worker.service';

describe('ActivityWorkerService', () => {
  let service: ActivityWorkerService;

  const mockSqs = { deleteMessage: jest.fn(), receiveMessages: jest.fn() };
  const mockPrisma = { userActivity: { create: jest.fn() } };
  // 폴링을 끈 상태로 서비스를 구성하여 테스트에서 무한 루프가 돌지 않게 한다.
  const mockConfig = { get: jest.fn().mockReturnValue(false) };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ActivityWorkerService,
        { provide: SqsClientService, useValue: mockSqs },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = moduleRef.get(ActivityWorkerService);
    jest.clearAllMocks();
  });

  const validMessage: Message = {
    MessageId: 'msg-1',
    ReceiptHandle: 'rh-1',
    Body: JSON.stringify({
      userId: '11111111-1111-1111-1111-111111111111',
      activityType: 'login',
      details: { ip: '127.0.0.1' },
      timestamp: new Date().toISOString(),
    }),
  };

  it('유효한 메시지를 DB 에 적재하고 큐에서 삭제한다', async () => {
    mockPrisma.userActivity.create.mockResolvedValue({ id: 'activity-1' });

    await service.processMessage(validMessage);

    expect(mockPrisma.userActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: '11111111-1111-1111-1111-111111111111',
        activityType: 'login',
        details: { ip: '127.0.0.1' },
        occurredAt: expect.any(Date),
      }),
    });
    expect(mockSqs.deleteMessage).toHaveBeenCalledWith('rh-1');
  });

  it('스키마에 맞지 않는 메시지는 적재하지 않고 폐기(삭제)한다', async () => {
    const badMessage: Message = {
      MessageId: 'msg-2',
      ReceiptHandle: 'rh-2',
      Body: JSON.stringify({ foo: 'bar' }),
    };

    await service.processMessage(badMessage);

    expect(mockPrisma.userActivity.create).not.toHaveBeenCalled();
    expect(mockSqs.deleteMessage).toHaveBeenCalledWith('rh-2');
  });

  it('DB 적재 실패 시 메시지를 삭제하지 않아 재시도되게 한다', async () => {
    mockPrisma.userActivity.create.mockRejectedValue(new Error('db down'));

    await service.processMessage(validMessage);

    expect(mockSqs.deleteMessage).not.toHaveBeenCalled();
  });
});
