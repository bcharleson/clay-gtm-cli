# clay-sequence-router — Multi-Signal Lead Routing

Evaluate a lead against multiple signals simultaneously and return the correct sequence assignment, rep routing, personalization tier, and send timing. Eliminates manual routing decisions — the agent fires this and gets back exactly what to do next.

## install

```bash
npm install -g clay-cli
brew install cloudflared
clay tables add \
  --name sequence-router \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Multi-signal routing — returns sequence, rep, tier, send timing"
clay listen start
```

## commands

```bash
# Route a lead with all available signals
clay fire sequence-router \
  --data '{
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "email": "john@acme.com",
    "source": "inbound_demo_request"
  }' \
  --wait

# Route with pre-enriched data
clay fire sequence-router \
  --data '{
    "first_name": "Jane",
    "email": "jane@acme.com",
    "company_domain": "acme.com",
    "icp_tier": "A",
    "intent_score": 82,
    "job_changed_recently": false,
    "source": "outbound_list",
    "territory": "west"
  }' \
  --wait

# Route an inbound lead (SDR assignment)
clay fire sequence-router \
  --data '{
    "email": "lead@prospect.com",
    "source": "content_download",
    "content_piece": "RevOps Benchmark Report",
    "company_domain": "prospect.com"
  }' \
  --wait
```

## output

```json
{
  "success": true,
  "table": "sequence-router",
  "data": {
    "lead_email": "jane@acme.com",
    "routing_decision": {
      "sequence": "high_touch_founder_outreach",
      "sequence_id": "seq_abc123",
      "rep_name": "Alex Johnson",
      "rep_email": "alex@yourcompany.com",
      "rep_reason": "territory_west + account_size",
      "priority": "high",
      "sla_hours": 1
    },
    "personalization_tier": "A",
    "send_timing": {
      "recommended_day": "Tuesday",
      "recommended_time": "10:00 AM",
      "recipient_timezone": "America/Los_Angeles",
      "send_utc": "2026-03-10T18:00:00Z"
    },
    "signals_used": ["icp_tier_a", "intent_high", "inbound_source", "series_b"],
    "suppression_check": "clear",
    "notes": "Inbound content download + high ICP + Series B = high-touch treatment. Assign to AE not SDR."
  }
}
```

Sequence options (customize to your playbook):
- `high_touch_founder_outreach` — A-tier + strong signal → AE direct
- `standard_ae_sequence` — B-tier → AE with SDR assist
- `sdr_outbound` — B/C-tier → SDR sequence
- `nurture_newsletter` — C-tier → long-form nurture
- `do_not_contact` — suppression list, competitor, invalid email
- `inbound_fast_follow` — Inbound request → <1 hour SLA

## clay table setup

1. Trigger: **Webhook**
2. Steps:
   - If source is inbound: skip enrichment, go straight to routing
   - If source is outbound: enrich + ICP score + intent check
   - Suppression list check (HTTP lookup against your DNC list)
   - Rep assignment logic (territory + account size formula columns)
   - Sequence assignment (tiered formula: ICP + intent + source → sequence)
   - Timing optimization (timezone lookup + best-day-to-send formula)
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Route a lead and extract just the assignment
clay fire sequence-router \
  --data '{"email":"jane@acme.com","company_domain":"acme.com","source":"outbound_list"}' \
  --wait \
  | jq '{sequence: .data.routing_decision.sequence, rep: .data.routing_decision.rep_name, priority: .data.routing_decision.priority}'

# Get optimal send timing
clay fire sequence-router \
  --data '{"email":"jane@acme.com","company_domain":"acme.com","source":"outbound_list"}' \
  --wait \
  | jq '.data.send_timing'

# Check if lead is on suppression list before any action
RESULT=$(clay fire sequence-router \
  --data '{"email":"jane@acme.com","company_domain":"acme.com","source":"outbound_list"}' \
  --wait)

SUPPRESSED=$(echo $RESULT | jq -r '.data.suppression_check')
if [ "$SUPPRESSED" = "clear" ]; then
  echo "Route to: $(echo $RESULT | jq -r '.data.routing_decision.sequence')"
else
  echo "SUPPRESSED: $SUPPRESSED — do not contact"
fi

# Batch route a new prospect list
cat new_prospects.json | jq -c '.[]' | while read lead; do
  clay fire sequence-router --data "$lead" --wait \
    | jq '{email: .data.lead_email, sequence: .data.routing_decision.sequence, rep: .data.routing_decision.rep_name}'
done

# Inbound fast-follow routing (sub-1 hour SLA)
clay fire sequence-router \
  --data '{"email":"inbound@prospect.com","source":"demo_request","company_domain":"prospect.com"}' \
  --wait | jq 'select(.data.routing_decision.sla_hours <= 1)'
```

## row limit

```bash
clay usage show sequence-router
clay tables reset sequence-router --webhook-url https://app.clay.com/webhook/NEW_ID
```
