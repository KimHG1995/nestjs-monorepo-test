import { randomUUID } from 'crypto';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { SqsClientService } from '@app/sqs-client';

import { ApiServerModule } from '../src/api-server.module';

describe('활동 추적기 (e2e)', () => {
  let app: INestApplication;
  let sqsClientService: SqsClientService;

  // SqsClientService 모의(mock) 객체
  const mockSqsClientService = {
    sendMessage: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [ApiServerModule],
    })
      // SqsClientService를 모의 객체로 대체
      .overrideProvider(SqsClientService)
      .useValue(mockSqsClientService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    sqsClientService = moduleFixture.get<SqsClientService>(SqsClientService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // 각 테스트 전에 모의 객체의 호출 기록을 초기화
    mockSqsClientService.sendMessage.mockClear();
  });

  it('/activity/track (POST) - 활동을 성공적으로 추적해야 함', () => {
    const userId = randomUUID();
    const activityPayload = {
      userId,
      activityType: 'login',
      timestamp: new Date().toISOString(),
      details: { ip: '127.0.0.1' },
    };

    // 이 테스트를 위해 sendMessage의 모의 구현 설정
    mockSqsClientService.sendMessage.mockResolvedValue({
      MessageId: 'mock-message-id',
    });

    return request(app.getHttpServer())
      .post('/activity/track')
      .send(activityPayload)
      .expect(201)
      .then((response) => {
        // 응답은 표준 성공 봉투로 정형화된다.
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual({ messageId: 'mock-message-id' });
        expect(response.body.meta).toMatchObject({
          path: '/activity/track',
          traceId: expect.any(String),
        });
        // sendMessage가 올바른 인자와 함께 호출되었는지 검증
        expect(sqsClientService.sendMessage).toHaveBeenCalledWith(
          activityPayload,
          userId,
        );
      });
  });

  it('/activity/track (POST) - 잘못된 데이터는 RFC 7807 형식으로 400을 반환해야 함', () => {
    const invalidPayload = {
      userId: 'not-a-uuid', // 잘못된 UUID
      activityType: 'unknown_activity', // enum에 없는 값
      timestamp: '2023-10-27', // 잘못된 형식
    };

    return request(app.getHttpServer())
      .post('/activity/track')
      .send(invalidPayload)
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/)
      .then((response) => {
        expect(response.body).toMatchObject({
          status: 400,
          code: 'VALIDATION_FAILED',
        });
        expect(Array.isArray(response.body.errors)).toBe(true);
        const fields = response.body.errors.map(
          (e: { name: string }) => e.name,
        );
        expect(fields).toEqual(
          expect.arrayContaining(['userId', 'activityType', 'timestamp']),
        );
      });
  });
});
