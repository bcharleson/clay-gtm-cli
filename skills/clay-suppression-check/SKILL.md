# clay-suppression-check — Opt-Out and DNC Validation

Check a contact or list against opt-out, unsubscribe, and do-not-contact lists before any outreach. Prevents compliance violations, protects sender reputation, and ensures you never email someone who has asked to be removed. Always run this before adding a lead to a sequence.

## install

```bash
npm install -g clay-cli
brew install cloudflared
clay tables add \
  --name suppression-check \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Suppression/DNC check — validate before any outreach"
clay listen start
```

## commands

```bash
# Check a single contact
clay fire suppression-check \
  --data '{"email": "john@acme.com"}' \
  --wait

# Check with domain-level suppression (e.g. entire company opted out)
clay fire suppression-check \
  --data '{
    "email": "john@acme.com",
    "company_domain": "acme.com",
    "linkedin_url": "https://linkedin.com/in/jdoe"
  }' \
  --wait

# Batch check before a campaign launch
cat campaign_leads.json | jq -c '.[] | {email: .email, company_domain: .domain}' \
  | while read lead; do
    clay fire suppression-check --data "$lead" --wait \
      | jq 'select(.data.suppressed == true) | {email: .data.email, reason: .data.suppression_reason}'
  done
```

## output

```json
{
  "success": true,
  "table": "suppression-check",
  "data": {
    "email": "john@acme.com",
    "suppressed": false,
    "domain_suppressed": false,
    "checks_run": [
      {"list": "internal_unsubscribe", "result": "clear"},
      {"list": "global_opt_out", "result": "clear"},
      {"list": "competitor_employees", "result": "clear"},
      {"list": "existing_customers", "result": "clear"},
      {"list": "open_opportunities", "result": "clear"}
    ],
    "safe_to_contact": true,
    "suppression_reason": null
  }
}
```

Suppression reasons (when `suppressed: true`):
- `unsubscribed` — Explicitly opted out
- `hard_bounced` — Email previously hard-bounced
- `competitor_employee` — Works at a competitor
- `existing_customer` — Already a customer
- `open_opportunity` — Active deal in pipeline — do not cold outreach
- `domain_suppressed` — Entire company domain on DNC list
- `global_opt_out` — On third-party opt-out registry (e.g. One Unsubscribe)
- `do_not_contact` — Manually flagged by a rep

## clay table setup

1. Trigger: **Webhook**
2. Steps:
   - Internal Unsubscribe check (HTTP lookup against your CRM/ESP unsubscribe list)
   - Global opt-out registry check
   - Competitor domain check (formula: email domain in competitor list)
   - Existing customer check (HTTP lookup against CRM)
   - Open opportunity check (HTTP lookup against CRM pipeline)
   - Manual DNC list check
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Always run before adding to any sequence
EMAIL="john@acme.com"
SUPPRESSED=$(clay fire suppression-check \
  --data "{\"email\":\"$EMAIL\"}" \
  --wait | jq -r '.data.suppressed')

if [ "$SUPPRESSED" = "false" ]; then
  echo "Clear to contact: $EMAIL"
  # Proceed with outbound-prep or sequence enrollment
else
  REASON=$(clay fire suppression-check --data "{\"email\":\"$EMAIL\"}" --wait | jq -r '.data.suppression_reason')
  echo "SUPPRESSED ($REASON): $EMAIL — skip"
fi

# Pre-campaign validation — flag all suppressed leads
cat campaign_list.json | jq -c '.[]' | while read lead; do
  RESULT=$(clay fire suppression-check --data "$lead" --wait)
  SUPPRESSED=$(echo $RESULT | jq -r '.data.suppressed')
  if [ "$SUPPRESSED" = "true" ]; then
    echo $RESULT | jq '{email: .data.email, reason: .data.suppression_reason}'
  fi
done

# Get clean count before campaign launch
TOTAL=$(wc -l < campaign_list.json)
SUPPRESSED_COUNT=$(cat campaign_list.json | jq -c '.[]' | while read lead; do
  clay fire suppression-check --data "$lead" --wait \
    | jq 'select(.data.suppressed == true)' 
done | wc -l)
echo "Campaign: $TOTAL total, $SUPPRESSED_COUNT suppressed, $((TOTAL - SUPPRESSED_COUNT)) safe to send"
```

## row limit

```bash
clay usage show suppression-check
clay tables reset suppression-check --webhook-url https://app.clay.com/webhook/NEW_ID
```
