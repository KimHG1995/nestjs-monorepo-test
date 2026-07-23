import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { WebServerModule } from '../src/web-server.module';

describe('web-server 표준 통신 프로토콜 (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [WebServerModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('성공 응답 정형화 (봉투)', () => {
    it('POST /widgets — 유효한 요청은 201 과 { success, data, meta } 봉투를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/widgets')
        .send({ name: '위젯 A', color: 'red', quantity: 3, tags: ['a'] })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        name: '위젯 A',
        color: 'red',
        quantity: 3,
        tags: ['a'],
      });
      expect(res.body.data.id).toEqual(expect.any(String));
      expect(res.body.meta).toMatchObject({
        path: '/widgets',
        timestamp: expect.any(String),
        traceId: expect.any(String),
      });
    });

    it('GET /widgets — 목록은 페이지네이션 메타와 함께 봉투로 반환된다', async () => {
      const res = await request(app.getHttpServer())
        .get('/widgets?page=1&limit=10')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        total: expect.any(Number),
        page: 1,
        limit: 10,
      });
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });
  });

  describe('요청 검증 정형화 (Zod → RFC 7807)', () => {
    it('POST /widgets — 잘못된 요청은 400 problem+json 과 errors[] 를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/widgets')
        .send({ name: '', color: 'purple', quantity: -1 })
        .expect(400)
        .expect('Content-Type', /application\/problem\+json/);

      expect(res.body).toMatchObject({
        status: 400,
        code: 'VALIDATION_FAILED',
        title: 'Bad Request',
        type: expect.stringContaining('/problems/'),
      });
      expect(Array.isArray(res.body.errors)).toBe(true);
      const fields = res.body.errors.map((e: { name: string }) => e.name);
      expect(fields).toEqual(
        expect.arrayContaining(['name', 'color', 'quantity']),
      );
      expect(res.body.errors[0]).toMatchObject({
        name: expect.any(String),
        reason: expect.any(String),
        code: expect.any(String),
      });
      expect(res.body.traceId).toEqual(expect.any(String));
    });
  });

  describe('에러 응답 정형화 (RFC 7807)', () => {
    it('GET /widgets/:id — 없는 리소스는 404 problem+json 을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get('/widgets/00000000-0000-0000-0000-000000000000')
        .expect(404)
        .expect('Content-Type', /application\/problem\+json/);

      expect(res.body).toMatchObject({
        status: 404,
        title: 'Not Found',
        code: 'NOT_FOUND',
      });
      expect(res.body.instance).toContain('/widgets/');
    });
  });

  describe('봉투 예외 (@SkipResponseTransform)', () => {
    it('GET /health — 헬스체크는 봉투 없이 원본을 반환한다', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok' });
      expect(res.body.success).toBeUndefined();
    });
  });

  describe('전체 수명주기', () => {
    it('생성 → 조회 → 수정 → 삭제(204) → 재조회(404)', async () => {
      const created = await request(app.getHttpServer())
        .post('/widgets')
        .send({ name: '수명주기', color: 'blue', quantity: 1 })
        .expect(201);
      const id = created.body.data.id;

      await request(app.getHttpServer()).get(`/widgets/${id}`).expect(200);

      const patched = await request(app.getHttpServer())
        .patch(`/widgets/${id}`)
        .send({ quantity: 99 })
        .expect(200);
      expect(patched.body.data.quantity).toBe(99);

      await request(app.getHttpServer()).delete(`/widgets/${id}`).expect(204);
      await request(app.getHttpServer()).get(`/widgets/${id}`).expect(404);
    });
  });
});
