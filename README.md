# NestJS 이벤트 기반 모노레포 프로젝트

이 프로젝트는 NestJS를 사용하여 구축된 이벤트 기반 아키텍처의 모의(mock-up) 템플릿입니다. 사용자 활동을 API 서버에서 받아 SQS와 같은 메시지 큐로 전송하고, 별도의 워커가 이 메시지를 처리하는 구조를 가지고 있습니다.

## 주요 기술 스택

- **프레임워크**: [NestJS](https://nestjs.com/) (Monorepo)
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
│   └── sqs-client/       # SQS 통신을 위한 공용 라이브러리
├── .vscode/              # VSCode 워크스페이스 설정
│   ├── extensions.json   # 추천 확장 프로그램
│   └── settings.json     # 워크스페이스 설정 (포맷팅, 린팅)
├── .editorconfig         # 편집기 설정
├── .prettierrc           # Prettier 설정
├── eslint.config.mjs     # ESLint 플랫 설정 (최신)
└── ...
```

### 애플리케이션

- **`api-server`**: 사용자의 활동(예: 로그인, 상품 조회)을 HTTP 요청으로 받아 SQS 큐에 기록합니다. Zod를 통해 요청 데이터의 유효성을 검사하며, Swagger를 통해 API 문서를 제공합니다.
- **`activity-worker`**: SQS 큐를 주기적으로 폴링하여 메시지를 수신하고, 수신된 메시지를 처리하는 백그라운드 워커입니다. (현재는 콘솔에 로그 출력)

### 라이브러리

- **`sqs-client`**: AWS SQS v3 SDK를 사용하여 메시지 송/수신 로직을 캡슐화한 공용 라이브러리입니다. FIFO 큐의 `MessageGroupId`와 `MessageDeduplicationId`를 활용하도록 설계되었습니다.

---

## 시작하기

### 사전 준비

- [Node.js](https://nodejs.org/en/) (v18 이상 권장)
- [npm](https://www.npmjs.com/)
- (선택) [Docker](https://www.docker.com/) 및 [LocalStack](https://localstack.cloud/) - 실제 SQS 연동 테스트 시 필요

### 1. 의존성 설치

프로젝트 루트에서 다음 명령어를 실행하여 모든 의존성을 설치합니다.

```bash
npm install
```

### 2. 애플리케이션 실행

각 애플리케이션은 별도의 터미널에서 실행해야 합니다.

**터미널 1: `api-server` 실행**

```bash
npm run start:dev api-server
```
- API 서버는 `http://localhost:3000`에서 실행됩니다.
- Swagger API 문서는 `http://localhost:3000/api-docs`에서 확인할 수 있습니다.

**터미널 2: `activity-worker` 실행**

```bash
npm run start:dev activity-worker
```
- 워커가 시작되면 SQS 큐를 폴링하기 시작합니다.

### 3. E2E 테스트 실행

`api-server`의 엔드포인트를 테스트하려면 다음 명령어를 실행하세요.

```bash
npm run test:e2e -- --config apps/api-server/test/jest-e2e.json
```

---

## 개발 환경

이 프로젝트는 일관된 개발 환경을 위해 몇 가지 도구와 설정을 포함하고 있습니다.

### 코드 스타일 및 품질

- **포매팅**: `prettier --write .` 또는 `npm run format` 명령어로 전체 코드의 서식을 맞출 수 있습니다.
- **린팅**: `eslint . --fix` 또는 `npm run lint` 명령어로 코드 품질 문제를 검사하고 자동으로 수정할 수 있습니다.

### 추천 VSCode 확장 프로그램

VSCode를 사용하는 경우, `.vscode/extensions.json`에 정의된 다음 확장 프로그램을 설치하면 개발 효율성이 크게 향상됩니다.

- **EditorConfig for VS Code** (`EditorConfig.EditorConfig`)
- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier - Code formatter** (`esbenp.prettier-vscode`)

`.vscode/settings.json` 덕분에 파일을 저장할 때마다 Prettier와 ESLint가 자동으로 실행됩니다.