#!/usr/bin/env bash
# ==============================================================================
# Script: check_bedrock_models.sh
# Purpose: Check which Bedrock vision/multimodal models are available and accessible
#          in your AWS account by testing an actual image invocation.
# Location: Outside backend directory (/home/friday/.data/drope/scripts)
# ==============================================================================

set -euo pipefail

REGION="${1:-${AWS_REGION:-us-east-1}}"
TEST_IMAGE="${2:-${HOME}/Downloads/floor_plan.png}"
OUTPUT_DIR="/tmp/bedrock_check_$$"

mkdir -p "${OUTPUT_DIR}"
trap 'rm -rf "${OUTPUT_DIR}"' EXIT

echo "============================================================"
echo " Amazon Bedrock Model Availability & Vision Test"
echo "============================================================"
echo " AWS Region : ${REGION}"
echo " Test Image : ${TEST_IMAGE}"
echo " Caller ARN : $(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null || echo 'Unknown')"
echo "============================================================"

if [ ! -f "${TEST_IMAGE}" ]; then
  echo "Error: Test image not found at ${TEST_IMAGE}"
  exit 1
fi

# Prepare a tiny base64 encoded image thumbnail for quick payload test
IMAGE_B64=$(base64 -w 0 "${TEST_IMAGE}")

echo ""
echo "Phase 1: Checking Model Authorization Status (get-foundation-model-availability)..."
echo "------------------------------------------------------------"

CANDIDATES=(
  # Claude Models
  "anthropic.claude-haiku-4-5-20251001-v1:0"
  "anthropic.claude-sonnet-4-5-20250929-v1:0"
  "anthropic.claude-sonnet-4-20250514-v1:0"
  "anthropic.claude-opus-4-5-20251101-v1:0"
  # Amazon Nova Models
  "amazon.nova-lite-v1:0"
  "amazon.nova-pro-v1:0"
  "amazon.nova-2-lite-v1:0"
  # Meta Models
  "meta.llama4-scout-17b-instruct-v1:0"
  # Mistral
  "mistral.pixtral-large-2502-v1:0"
  # Qwen
  "qwen.qwen3-vl-235b-a22b"
)

AUTHORIZED_MODELS=()

for MODEL in "${CANDIDATES[@]}"; do
  printf "Checking %-44s ... " "${MODEL}"
  AVAIL=$(aws bedrock get-foundation-model-availability \
    --model-id "${MODEL}" \
    --region "${REGION}" \
    --output json 2>&1 || true)

  AUTH_STATUS=$(echo "${AVAIL}" | jq -r '.authorizationStatus // "ERROR"')
  AGREE_STATUS=$(echo "${AVAIL}" | jq -r '.agreementAvailability.status // "N/A"')

  if [ "${AUTH_STATUS}" == "AUTHORIZED" ]; then
    echo "AUTHORIZED (Agreement: ${AGREE_STATUS})"
    AUTHORIZED_MODELS+=("${MODEL}")
  else
    echo "NOT AUTHORIZED (Status: ${AUTH_STATUS})"
  fi
done

echo ""
echo "------------------------------------------------------------"
echo "Phase 2: Live Inference Test with Image Payload"
echo "------------------------------------------------------------"

if [ ${#AUTHORIZED_MODELS[@]} -eq 0 ]; then
  echo "⚠️  No models are currently in 'AUTHORIZED' status for account."
  echo "   Testing top models directly with an image payload to confirm actual API response..."
  TEST_CANDIDATES=(
    "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    "us.amazon.nova-lite-v1:0"
    "us.amazon.nova-pro-v1:0"
  )
else
  TEST_CANDIDATES=("${AUTHORIZED_MODELS[@]}")
fi

SUCCESSFUL_MODELS=()

for MODEL in "${TEST_CANDIDATES[@]}"; do
  printf "Invoking %-44s ... " "${MODEL}"

  if [[ "${MODEL}" == *"anthropic"* ]]; then
    # Claude Request Schema
    cat <<EOF > "${OUTPUT_DIR}/payload.json"
{
  "anthropic_version": "bedrock-2023-05-31",
  "max_tokens": 100,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "image",
          "source": {
            "type": "base64",
            "media_type": "image/png",
            "data": "${IMAGE_B64}"
          }
        },
        {
          "type": "text",
          "text": "Identify what is in this image in one brief sentence."
        }
      ]
    }
  ]
}
EOF
  elif [[ "${MODEL}" == *"nova"* ]]; then
    # Nova Request Schema
    cat <<EOF > "${OUTPUT_DIR}/payload.json"
{
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "image": {
            "format": "png",
            "source": {
              "bytes": "${IMAGE_B64}"
            }
          }
        },
        {
          "text": "Identify what is in this image in one brief sentence."
        }
      ]
    }
  ]
}
EOF
  else
    echo "SKIPPED (Unknown payload format)"
    continue
  fi

  RESULT=$(aws bedrock-runtime invoke-model \
    --region "${REGION}" \
    --model-id "${MODEL}" \
    --body fileb://"${OUTPUT_DIR}/payload.json" \
    --cli-binary-format raw-in-base64-out \
    "${OUTPUT_DIR}/response.json" 2>&1 || true)

  if [ -f "${OUTPUT_DIR}/response.json" ]; then
    echo "SUCCESS ✅"
    SUCCESSFUL_MODELS+=("${MODEL}")
    echo "  Response preview: $(head -c 120 "${OUTPUT_DIR}/response.json")..."
    rm -f "${OUTPUT_DIR}/response.json"
  else
    ERR_MSG=$(echo "${RESULT}" | grep -o '([a-zA-Z]*Exception).*:.*' || echo "${RESULT}" | tr '\n' ' ')
    echo "FAILED ❌ (${ERR_MSG})"
  fi
done

echo ""
echo "============================================================"
echo " Summary"
echo "============================================================"
if [ ${#SUCCESSFUL_MODELS[@]} -gt 0 ]; then
  echo "✅ Accessible Vision Models Ready to Use:"
  for M in "${SUCCESSFUL_MODELS[@]}"; do
    echo "   - ${M}"
  done
else
  echo "❌ No models could be invoked with the image payload."
  echo ""
  echo "Root Cause: AWS Bedrock Model Access is not enabled for this account."
  echo "Even with AdministratorAccess IAM role, AWS requires explicitly requesting model"
  echo "access in the AWS Bedrock Console under: Amazon Bedrock -> Model access."
  echo ""
  echo "Steps to Enable Model Access:"
  echo " 1. Open the AWS Console: https://console.aws.amazon.com/bedrock/"
  echo " 2. Ensure Region is set to 'us-east-1' (N. Virginia)."
  echo " 3. On the left navigation pane, click 'Model access'."
  echo " 4. Click 'Modify model access' or 'Enable specific models'."
  echo " 5. Select 'Anthropic' (Claude models) or 'Amazon' (Nova models)."
  echo " 6. Submit the request (takes 1-2 minutes to become active)."
fi
echo "============================================================"
