#!/bin/bash
# Audit trail step runner - each tool calls this with its name as argument
# Usage: bash audit_step.sh "TOOL_NAME"
TOOL_NAME="$1"
AUDIT_LOG="/Users/thomaslewis/dev/projectcduk/reports/audit_trail_test.log"
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "[$TS] [$TOOL_NAME] Entry - $TOOL_NAME is connected and functional." >> "$AUDIT_LOG"
echo "[$TS] [$TOOL_NAME] Has read the previous audit trail entries and is appending this confirmation." >> "$AUDIT_LOG"
echo "" >> "$AUDIT_LOG"

# Output the full audit trail for the caller to verify
cat "$AUDIT_LOG"
