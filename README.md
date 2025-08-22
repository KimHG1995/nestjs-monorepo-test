# NestJS 이벤트 기반 모노레포 프로젝트

이 프로젝트는 NestJS를 사용하여 구축된 이벤트 기반 아키텍처의 모의(mock-up) 템플릿입니다. 사용자 활동을 API 서버에서 받아 SQS와 같은 메시지 큐로 전송하고, 별도의 워커가 이 메시지를 처리하는 구조를 가지고 있습니다.

## 주요 기술 스택

- **프레임워크**: [NestJS](https://nestjs.com/) (Monorepo) + **SWC**
- **언어**: [TypeScript](https://www.typescriptlang.org/)
- **API 문서화**: [Swagger (OpenAPI)](https://swagger.io/)
- **데이터 유효성 검사**: [Zod](https://zod.dev/) 및 `nestjs-zod`
- **메시지 큐 (가상)**: [AWS SQS v3 SDK](https://aws.amazon.com/sqs/) (LocalStack 연동을 가정)
- **코드 스타일 및 품질**:
  - **Linter**: [ESLint](https://eslint.org/) (Flat Config)
  - **Formatter**: [Prettier](https://prettier.io/)
  - **EditorConfig**: 일관된 편집기 설정

---

## 프로젝트 구조

이 프로젝트는 NestJS의 모노레포 모드를 사용하여 구성되었습니다.

```
/
├── apps/
│   ├── api-server/       # 외부 요청을 받는 API 서버 (이벤트 발행자)
│   └── activity-worker/  # SQS 메시지를 처리하는 워커 (이벤트 소비자)
├── libs/
│   ├── common-utils/     # 전역 필터, 인터셉터 등 공용 유틸리티
│   └── sqs-client/       # SQS 통신을 위한 공용 라이브러리
├── .vscode/              # VSCode 워크스페이스 설정
└── ...
```

### 애플리케이션

- **`api-server`**: 사용자의 활동(예: 로그인, 상품 조회)을 HTTP 요청으로 받아 SQS 큐에 기록합니다. Zod를 통해 요청 데이터의 유효성을 검사하며, Swagger를 통해 API 문서를 제공합니다.
- **`activity-worker`**: SQS 큐를 주기적으로 폴링하여 메시지를 수신하고, 수신된 메시지를 처리하는 백그라운드 워커입니다. (현재는 콘솔에 로그 출력)

### 라이브러리

- **`common-utils`**: 전역 예외 필터(RFC 7807 표준)와 응답 정형화 인터셉터를 제공하여 API의 일관성을 유지합니다.
- **`sqs-client`**: AWS SQS v3 SDK를 사용하여 메시지 송/수신 로직을 캡슐화한 공용 라이브러리입니다.

---

## 시작하기

### 사전 준비

- [Node.js](https://nodejs.org/en/) (v18 이상 권장)
- [npm](https://www.npmjs.com/)
- (선택) [Docker](https://www.docker.com/) 및 [LocalStack](https://localstack.cloud/) - 실제 SQS 연동 테스트 시 필요

### 1. 의존성 설치

```bash
npm install
```

### 2. 애플리케이션 실행

**터미널 1: `api-server` 실행**

```bash
npm run start:dev api-server
```

**터미널 2: `activity-worker` 실행**

```bash
npm run start:dev activity-worker
```

### 3. E2E 테스트 실행

```bash
npm run test:e2e -- --config apps/api-server/test/jest-e2e.json
```

---

## 개발 환경

이 프로젝트는 일관된 개발 환경을 위해 몇 가지 도구와 설정을 포함하고 있습니다.

### 코드 스타일 및 품질

- **포매팅**: `npm run format`
- **린팅**: `npm run lint`

### 추천 VSCode 확장 프로그램

- **EditorConfig for VS Code** (`EditorConfig.EditorConfig`)
- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier - Code formatter** (`esbenp.prettier-vscode`)

---

## 향후 개선 계획 (TODO)

- [ ] **데이터베이스 연동 (Prisma)**
  - `libs`에 `prisma-client` 라이브러리(서브모듈)를 추가하여 데이터베이스 스키마 및 클라이언트를 중앙에서 관리합니다.
  - `activity-worker`가 SQS 메시지를 받아 실제 데이터베이스에 사용자 활동을 기록하도록 로직을 수정합니다.

- [ ] **ERD (Entity-Relationship Diagram) 자동 생성**
  - Prisma 스키마가 변경될 때마다 `prisma-erd-generator`와 같은 도구를 사용하여 ERD를 자동으로 업데이트하는 워크플로우를 구축합니다.

- [ ] **CI/CD 파이프라인 구축**
  - **CI (Continuous Integration)**: GitHub Actions를 사용하여 Pull Request 생성 시 자동으로 빌드, 린트, 테스트를 실행합니다.
  - **CD (Continuous Deployment)**: Main 브랜치에 머지될 때, Docker 이미지를 빌드하여 Amazon ECR에 푸시하고, ECS 또는 EKS에 자동으로 배포하는 파이프라인을 구축합니다.

- [ ] **설정 관리 (ConfigModule)**
  - NestJS의 `ConfigModule`을 도입하여 환경 변수(`.env`)를 타입 세이프하게 관리하고, 각 애플리케이션에 주입합니다.

- [ ] **로깅 시스템 개선**
  - `winston`이나 `pino` 같은 로깅 라이브러리를 도입하여 로그 레벨 관리, 로그 포맷 통일, 파일 로깅 등을 구현합니다.
