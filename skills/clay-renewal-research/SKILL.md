# clay-renewal-research — Pre-Renewal Account Intelligence

Research an account 60-90 days before renewal to understand health, risk, expansion potential, champion stability, and competitive threats. Gives CS and AEs the full picture before entering renewal negotiations.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared
clay tables add \
  --name renewal-research \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Pre-renewal account intelligence — health, risk, champion stability, expansion"
clay listen start
```

## commands

```bash
# Full renewal research
clay fire renewal-research \
  --data '{
    "company_domain": "customer.com",
    "renewal_date": "2026-06-01",
    "current_arr": 48000,
    "current_plan": "Growth",
    "account_owner": "sarah@yourcompany.com"
  }' \
  --wait --timeout 240

# Renewal research with health signals passed in
clay fire renewal-research \
  --data '{
    "company_domain": "customer.com",
    "renewal_date": "2026-06-01",
    "current_arr": 48000,
    "last_login_days_ago": 3,
    "monthly_active_users": 28,
    "support_tickets_open": 1,
    "nps_score": 8,
    "champion_name": "John Doe",
    "champion_linkedin": "https://linkedin.com/in/jdoe"
  }' \
  --wait --timeout 240
```

## output

```json
{
  "success": true,
  "table": "renewal-research",
  "data": {
    "company": "CustomerCo",
    "domain": "customer.com",
    "renewal_date": "2026-06-01",
    "days_to_renewal": 87,
    "renewal_risk": "low",
    "renewal_score": 81,
    "health_signals": {
      "product_engagement": "high",
      "last_login_days_ago": 3,
      "monthly_active_users": 28,
      "support_open_tickets": 1,
      "nps_score": 8,
      "executive_sponsor_engaged": true
    },
    "champion_health": {
      "champion_name": "John Doe",
      "champion_title": "VP Revenue Operations",
      "champion_still_at_company": true,
      "champion_promoted": true,
      "champion_new_title": "SVP Revenue",
      "champion_risk": "low"
    },
    "competitive_risk": {
      "competitor_activity_detected": false,
      "g2_comparison_activity": false,
      "competitor_contacted_by": null
    },
    "company_health": {
      "headcount_change_pct": 12,
      "recent_funding": false,
      "financial_stress_signals": false,
      "recent_layoffs": false
    },
    "expansion_opportunity": {
      "has_opportunity": true,
      "type": "seat_expansion",
      "estimated_arr_increase": 18000,
      "rationale": "Team grew 12%, at 87% seat capacity"
    },
    "renewal_recommendation": "expand_and_renew",
    "renewal_strategy": "Champion was promoted — lead with congrats, position renewal as a no-brainer, come in with an expansion proposal given team growth. Avoid multi-threading risk (one strong champion is better than over-involving).",
    "risks": [],
    "talking_points": [
      "John was promoted — great time to discuss expanding the contract to match team growth",
      "87% seat utilization — expansion before renewal avoids a mid-year upgrade conversation",
      "No competitive activity detected — no urgency to discount"
    ]
  }
}
```

Renewal risk levels:
- `low` — Healthy engagement, stable champion, no competitive threats → standard renewal
- `medium` — Some usage dip or champion change → proactive check-in needed
- `high` — Low engagement + competitive signals + potential budget pressure → red account, escalate
- `critical` — Multiple risk factors aligned → executive involvement required

## clay table setup

1. Trigger: **Webhook**
2. Steps:
   - Company enrichment (current size, funding, layoff news)
   - Champion LinkedIn check (still at company? title change?)
   - Competitive activity check (G2 comparisons, intent data)
   - News lookup (financial stress signals, layoffs, restructuring)
   - Job postings (hiring freeze vs. growth)
   - AI Renewal Score + risk classification
   - AI Strategy recommendations
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Run renewal research on all accounts renewing in next 90 days
cat renewals_q2.json | jq -c '.[]' | while read account; do
  clay fire renewal-research --data "$account" --wait --timeout 240 \
    | jq '{
        company: .data.company,
        days_to_renewal: .data.days_to_renewal,
        risk: .data.renewal_risk,
        score: .data.renewal_score,
        strategy: .data.renewal_strategy
      }'
done

# Identify at-risk accounts
clay fire renewal-research \
  --data '{"company_domain":"customer.com","renewal_date":"2026-06-01","current_arr":48000}' \
  --wait --timeout 240 \
  | jq 'select(.data.renewal_risk == "high" or .data.renewal_risk == "critical")'

# Get renewal strategy for QBR prep
clay fire renewal-research \
  --data '{"company_domain":"customer.com","renewal_date":"2026-06-01","current_arr":48000}' \
  --wait --timeout 240 \
  | jq -r '.data.renewal_strategy'

# Check champion stability before reaching out
clay fire renewal-research \
  --data '{"company_domain":"customer.com","renewal_date":"2026-05-01","champion_linkedin":"https://linkedin.com/in/jdoe"}' \
  --wait --timeout 240 \
  | jq '.data.champion_health'

# Calculate total renewal ARR at risk
cat at_risk_accounts.json | jq -c '.[]' | while read account; do
  clay fire renewal-research --data "$account" --wait --timeout 240 \
    | jq 'select(.data.renewal_risk == "high") | .data.current_arr // 0'
done | awk '{sum += $1} END {print "ARR at risk: $" sum}'
```

## row limit

```bash
clay usage show renewal-research
clay tables reset renewal-research --webhook-url https://app.clay.com/webhook/NEW_ID
```
