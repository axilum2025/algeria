#!/usr/bin/env bash
set -euo pipefail
BASE_URL=${BASE_URL:-http://localhost:8080}

echo "== Health =="
curl -s "$BASE_URL/__health" || true

echo -e "\n== Invoices OCR =="
curl -s -X POST "$BASE_URL/api/finance/invoices/ocr" \
  -H 'Content-Type: application/json' \
  -d '{"fileUrl":"https://example.com/invoice.pdf"}'

echo -e "\n== Fraud Analyze =="
curl -s -X POST "$BASE_URL/api/finance/fraud/analyze" \
  -H 'Content-Type: application/json' \
  -d '{"transactions":[{"vendor":"ACME","amount":1500000,"date":"2025-12-01"},{"vendor":"ACME","amount":1500000,"date":"2025-12-02"}]}'

echo -e "\n== Cashflow Forecast =="
curl -s -X POST "$BASE_URL/api/finance/cashflow/forecast" \
  -H 'Content-Type: application/json' \
  -d '{"horizonDays":7}'

echo -e "\n== Expenses Classify =="
curl -s -X POST "$BASE_URL/api/finance/expenses/classify" \
  -H 'Content-Type: application/json' \
  -d '{"expenses":[{"description":"Abonnement SaaS CRM","amount":5000},{"description":"Taxi aéroport","amount":3000}]}'

echo -e "\n== Reports Generate =="
curl -s -X POST "$BASE_URL/api/finance/reports/generate" \
  -H 'Content-Type: application/json' \
  -d '{"period":"Q4-2025","format":"pdf"}'
