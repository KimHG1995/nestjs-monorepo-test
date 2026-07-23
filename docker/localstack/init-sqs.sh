#!/bin/bash
# LocalStack 준비 완료 시 실행되어 FIFO 큐를 생성합니다.
set -euo pipefail

awslocal sqs create-queue \
  --queue-name user-activity.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=true

echo "✅ SQS FIFO 큐 'user-activity.fifo' 가 생성되었습니다."
