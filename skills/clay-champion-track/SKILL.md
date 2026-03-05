# clay-champion-track — Track Customer Champions Across Job Changes

Monitor your best customer contacts for job changes. When a champion moves to a new company, that's your highest-converting outbound opportunity — they already know and trust your product. This skill detects those moves and returns the new company details + ready-to-send outreach context.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared
clay tables add \
  --name champion-track \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Track champions who changed jobs — instant warm outreach signal"
clay listen start
```

## commands

```bash
# Check if a known champion has moved
clay fire champion-track \
  --data '{
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "previous_company": "OldCustomer Inc",
    "previous_title": "VP of Sales"
  }' \
  --wait

# Check with email (for CRM-sourced contacts)
clay fire champion-track \
  --data '{
    "email": "john@oldcustomer.com",
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "customer_since": "2023-06-01"
  }' \
  --wait

# Batch monitor a list of champions
cat champions.json | jq -c '.[]' | while read champion; do
  clay fire champion-track --data "$champion" --wait \
    | jq 'select(.data.has_moved == true)'
done
```

## output

```json
{
  "success": true,
  "table": "champion-track",
  "data": {
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "full_name": "John Doe",
    "has_moved": true,
    "previous_company": "OldCustomer Inc",
    "previous_title": "VP of Sales",
    "new_company": "NewVenture Co",
    "new_title": "Chief Revenue Officer",
    "new_company_domain": "newventure.co",
    "new_company_employee_count": 180,
    "new_company_funding_stage": "Series A",
    "new_email": "john@newventure.co",
    "new_email_verified": true,
    "move_detected_date": "2026-02-10",
    "days_since_move": 23,
    "is_promotion": true,
    "new_company_icp_fit": true,
    "new_company_icp_tier": "A",
    "suggested_outreach": "Hey John — congrats on the CRO role at NewVenture! Given what you built at OldCustomer, thought you'd want to know we've added [feature] since you left. Happy to give you a quick tour of what's new.",
    "priority": "high"
  }
}
```

Priority levels:
- `high`: Moved + ICP fit + promoted + within 90 days
- `medium`: Moved + ICP fit + within 180 days
- `low`: Moved but poor ICP fit or >180 days ago
- `no_action`: Has not moved

## clay table setup

1. Trigger: **Webhook**
2. Steps:
   - LinkedIn Enrichment (get current role)
   - Compare current company vs. `previous_company` (formula column)
   - If moved: Company Enrichment on new company
   - ICP Score on new company
   - Email Finder at new company
   - AI column: generate `suggested_outreach` (reference old company, new role, product value)
   - Priority assignment
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Weekly scan of champion list — alert on moves
cat champions.json | jq -c '.[]' | while read champion; do
  RESULT=$(clay fire champion-track --data "$champion" --wait)
  MOVED=$(echo $RESULT | jq -r '.data.has_moved')
  PRIORITY=$(echo $RESULT | jq -r '.data.priority')
  NAME=$(echo $RESULT | jq -r '.data.full_name')

  if [ "$MOVED" = "true" ] && [ "$PRIORITY" = "high" ]; then
    echo "HIGH PRIORITY MOVE: $NAME"
    echo $RESULT | jq '.data.suggested_outreach'
  fi
done

# Filter for moves where new company is a good ICP fit
clay fire champion-track \
  --data '{"linkedin_url":"https://linkedin.com/in/jdoe","previous_company":"OldCo"}' \
  --wait | jq 'select(.data.new_company_icp_fit == true and .data.new_email_verified == true)'

# Get suggested outreach message for a moved champion
clay fire champion-track \
  --data '{"linkedin_url":"https://linkedin.com/in/jdoe","previous_company":"OldCo"}' \
  --wait | jq -r '.data.suggested_outreach'

# Track all champions at risk of churning (likely to leave)
# Use job-change skill to detect early signals (promotion to leadership elsewhere)
```

## row limit

```bash
clay usage show champion-track
clay tables reset champion-track --webhook-url https://app.clay.com/webhook/NEW_ID
```
