import { Test, TestingModule } from '@nestjs/testing';

import { SqsClientService } from '@app/sqs-client';

import { ApiServerController } from './api-server.controller';
import { ApiServerService } from './api-server.service';
import { TrackActivityDto } from './track-activity.dto';

describe('ApiServerController', () => {
  let controller: ApiServerController;
  const mockSqs = { sendMessage: jest.fn() };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ApiServerController],
      providers: [
        ApiServerService,
        { provide: SqsClientService, useValue: mockSqs },
      ],
    }).compile();

    controller = moduleRef.get<ApiServerController>(ApiServerController);
    mockSqs.sendMessage.mockReset();
  });

  it('활동을 SQS 로 전송하고 messageId 를 반환한다', async () => {
    mockSqs.sendMessage.mockResolvedValue({ MessageId: 'msg-123' });

    const dto = {
      userId: '11111111-1111-1111-1111-111111111111',
      activityType: 'login',
      timestamp: new Date().toISOString(),
    } as TrackActivityDto;

    await expect(controller.trackActivity(dto)).resolves.toEqual({
      messageId: 'msg-123',
    });
    expect(mockSqs.sendMessage).toHaveBeenCalledWith(dto, dto.userId);
  });

  it('상품 활동의 productId를 SQS 메시지에 보존한다', async () => {
    mockSqs.sendMessage.mockResolvedValue({ MessageId: 'msg-product-1' });
    const dto = {
      userId: '11111111-1111-1111-1111-111111111111',
      activityType: 'view_product',
      productId: '22222222-2222-2222-2222-222222222222',
      timestamp: '2026-07-23T00:00:00.000Z',
    } as TrackActivityDto;

    await controller.trackActivity(dto);

    expect(mockSqs.sendMessage).toHaveBeenCalledWith(dto, dto.userId);
  });
});
