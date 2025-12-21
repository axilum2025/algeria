#!/usr/bin/env bash
set -euo pipefail
BASE_URL=${BASE_URL:-http://localhost:8080}
INVOICE_URL=${INVOICE_URL:-https://raw.githubusercontent.com/Azure-Samples/documentintelligence-python-samples/main/sample_data/invoices/invoice_1.pdf}

if [[ -z "${APPSETTING_FORM_RECOGNIZER_ENDPOINT:-}" || -z "${APPSETTING_FORM_RECOGNIZER_KEY:-}" ]] && \
   [[ -z "${FORM_RECOGNIZER_ENDPOINT:-}" || -z "${FORM_RECOGNIZER_KEY:-}" ]]; then
  echo "[WARN] Form Recognizer non configuré. Le test utilisera le fallback stub."
fi

curl -s -X POST "$BASE_URL/api/finance/invoices/ocr" \
  -H 'Content-Type: application/json' \
  -d "{\"fileUrl\":\"$INVOICE_URL\"}" | jq '.'
