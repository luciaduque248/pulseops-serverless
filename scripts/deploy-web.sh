#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${STACK_NAME:-pulseops}"
AWS_REGION="${AWS_REGION:-us-east-1}"

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${AWS_REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" \
    --output text
}

export VITE_API_URL="$(stack_output ApiUrl)"
export VITE_COGNITO_USER_POOL_ID="$(stack_output UserPoolId)"
export VITE_COGNITO_CLIENT_ID="$(stack_output UserPoolClientId)"
WEB_BUCKET="$(stack_output FrontendBucketName)"
DISTRIBUTION_ID="$(stack_output CloudFrontDistributionId)"
WEB_URL="$(stack_output WebUrl)"

if [[ -z "${WEB_BUCKET}" || "${WEB_BUCKET}" == "None" ]]; then
  echo "Unable to resolve stack outputs. Deploy infrastructure first." >&2
  exit 1
fi

echo "Building frontend for ${VITE_API_URL}..."
npm run build -w @pulseops/web

echo "Uploading frontend to s3://${WEB_BUCKET}..."
aws s3 sync apps/web/dist "s3://${WEB_BUCKET}" --delete --region "${AWS_REGION}"

aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths '/*' >/dev/null

echo "PulseOps web deployment complete: ${WEB_URL}"
