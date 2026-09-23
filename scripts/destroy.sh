#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${STACK_NAME:-pulseops}"
AWS_REGION="${AWS_REGION:-us-east-1}"

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${AWS_REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" \
    --output text 2>/dev/null || true
}

WEB_BUCKET="$(stack_output FrontendBucketName)"
ATTACHMENTS_BUCKET="$(stack_output AttachmentsBucketName)"

for bucket in "${WEB_BUCKET}" "${ATTACHMENTS_BUCKET}"; do
  if [[ -n "${bucket}" && "${bucket}" != "None" ]]; then
    echo "Emptying s3://${bucket}..."
    aws s3 rm "s3://${bucket}" --recursive --region "${AWS_REGION}" || true
  fi
done

echo "Deleting ${STACK_NAME}..."
sam delete --stack-name "${STACK_NAME}" --region "${AWS_REGION}" --no-prompts
