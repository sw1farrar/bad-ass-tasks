#!/bin/bash
# =====================================================
# Bad Ass Tasks - Invite & Membership Lifecycle Fix
# =====================================================
# Unix / macOS / Linux version of the migration runner.
# Usage: bash scripts/apply-invite-lifecycle-fix.sh

set -e

echo ""
echo "=== Bad Ass Tasks - Membership Lifecycle Migration ==="
echo ""

SQL_FILE="supabase/fix-invite-lifecycle-rls-and-rpcs.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "ERROR: Could not find $SQL_FILE"
    echo "Please run this script from the project root."
    exit 1
fi

# Try Supabase CLI first
if command -v supabase &> /dev/null; then
    echo "Supabase CLI detected. Executing migration..."
    if supabase db execute --file "$SQL_FILE"; then
        echo ""
        echo "Migration applied successfully via Supabase CLI."
        exit 0
    else
        echo "Supabase CLI failed. Falling back to manual instructions..."
    fi
fi

# Try psql with env var
if command -v psql &> /dev/null && [ -n "$SUPABASE_DB_URL" ]; then
    echo "psql + SUPABASE_DB_URL detected. Executing..."
    psql "$SUPABASE_DB_URL" -f "$SQL_FILE"
    echo "Migration applied successfully."
    exit 0
fi

# Manual fallback
echo ""
echo "Could not apply the migration automatically."
echo ""
echo "Please apply it manually:"
echo ""
echo "1. Go to your Supabase Dashboard → SQL Editor"
echo "2. Copy the entire contents of: $SQL_FILE"
echo "3. Paste and click Run"
echo ""
echo "Or run manually:"
echo "  supabase db execute --file $SQL_FILE"
echo ""
echo "After running, restart your dev server."
echo ""