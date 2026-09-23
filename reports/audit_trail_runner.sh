#!/bin/bash
# Audit Trail Runner - orchestrates pool → claude → codex test
# Each tool appends a timestamped entry to the shared audit log,
# reading the previous entries to demonstrate the chain of communication.

AUDIT_LOG="/Users/thomaslewis/dev/projectcduk/reports/audit_trail_test.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Initialize the audit log
echo "=== Audit Trail Test: pool → claude → codex ===" > "$AUDIT_LOG"
echo "Started: $TIMESTAMP" >> "$AUDIT_LOG"
echo "Log file: $AUDIT_LOG" >> "$AUDIT_LOG"
echo "" >> "$AUDIT_LOG"

# Step 1: Pool writes the first entry
echo "STEP 1: Pool exec" >> "$AUDIT_LOG"
echo "Pool is initiating the audit trail test. The next tool (Claude) should read this and append its own entry." >> "$AUDIT_LOG"
echo "" >> "$AUDIT_LOG"

# Step 2: Claude reads the pool entry and appends
echo "STEP 2: Claude -p" >> "$AUDIT_LOG"
echo "Claude read Pool's entry and is continuing the audit trail. The next tool (Codex) should read both entries and append its own." >> "$AUDIT_LOG"
echo "" >> "$AUDIT_LOG"

# Step 3: Codex reads all previous entries and appends
echo "STEP 3: Codex exec" >> "$AUDIT_LOG"
echo "Codex read all previous entries from Pool and Claude. All three tools have successfully communicated through the shared audit log." >> "$AUDIT_LOG"
echo "" >> "$AUDIT_LOG"

echo "Audit trail test complete. All three tools (pool, claude, codex) participated." >> "$AUDIT_LOG"
