#!/bin/bash

# Test script for SSE streaming endpoint
# Usage: ./test-streaming.sh <auth-token> <mission-id>

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <auth-token> <mission-id>"
    echo ""
    echo "Example:"
    echo "  $0 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... 673ab2c3e8f9a1234567890c"
    exit 1
fi

TOKEN="$1"
MISSION_ID="$2"
BASE_URL="${3:-http://localhost:3000}"

echo "========================================="
echo "Testing SSE Streaming Endpoint"
echo "========================================="
echo "Base URL: $BASE_URL"
echo "Mission ID: $MISSION_ID"
echo "========================================="
echo ""

echo "Connecting to SSE endpoint..."
echo ""

curl -N -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream" \
  -H "Cache-Control: no-cache" \
  "$BASE_URL/ai/proposals/generate/stream?missionId=$MISSION_ID"

echo ""
echo "========================================="
echo "Stream ended"
echo "========================================="
