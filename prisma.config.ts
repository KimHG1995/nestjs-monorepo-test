import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'libs/prisma-client/prisma/schema.prisma',
  migrations: {
    path: 'libs/prisma-client/prisma/migrations',
  },
  datasource: {
    // 클라이언트 생성에는 DB 연결이 필요하지 않으므로 설치 단계에서도 설정을 읽을 수 있게 합니다.
    url: process.env.DATABASE_URL ?? '',
  },
});
