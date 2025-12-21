#!/usr/bin/env bash
set -euo pipefail
BASE_URL=${BASE_URL:-http://localhost:8080}

# Generate a report to ensure there is at least one blob
REPORT_RES=$(curl -s -X POST "$BASE_URL/api/finance/reports/generate" -H 'Content-Type: application/json' -d '{"period":"test-list","format":"pdf"}')
echo "$REPORT_RES"

# Extract blob name from URL (works for SAS or plain URL)
URL=$(echo "$REPORT_RES" | jq -r '.azureUrl // .url')
NAME=$(echo "$URL" | awk -F/ '{print $NF}' | cut -d'?' -f1)

# List reports
curl -s -X POST "$BASE_URL/api/finance/storage/list" -H 'Content-Type: application/json' -d '{"container":"reports"}' | jq '.'

# Delete the generated report blob
if [[ -n "$NAME" ]]; then
  echo "Deleting $NAME"
  curl -s -X POST "$BASE_URL/api/finance/storage/delete" -H 'Content-Type: application/json' -d "{\"container\":\"reports\",\"name\":\"$NAME\"}" | jq '.'
fi
