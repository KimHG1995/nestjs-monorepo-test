import { Test, TestingModule } from '@nestjs/testing';
import { ApiServerController } from './api-server.controller';
import { ApiServerService } from './api-server.service';

describe('ApiServerController', () => {
  let apiServerController: ApiServerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ApiServerController],
      providers: [ApiServerService],
    }).compile();

    apiServerController = app.get<ApiServerController>(ApiServerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(apiServerController.getHello()).toBe('Hello World!');
    });
  });
});
