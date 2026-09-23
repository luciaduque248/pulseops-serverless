#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${STACK_NAME:-pulseops}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "Building PulseOps SAM application..."
sam build --template-file infra/template.yaml

echo "Deploying stack ${STACK_NAME} to ${AWS_REGION}..."
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

echo "Infrastructure deployed."
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table
