# clay-expansion-signals — Upsell and Expansion Signal Detection

Monitor existing customers for signals that indicate upsell and expansion readiness: team growth, new product launches, funding, executive hires, and increased usage. Enables CS and AE teams to reach out at the exact right moment with the right expansion offer.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared
clay tables add \
  --name expansion-signals \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Customer expansion signals — upsell readiness, growth triggers, hiring"
clay listen start
```

## commands

```bash
# Check expansion signals for an existing customer
clay fire expansion-signals \
  --data '{
    "company_domain": "customer.com",
    "customer_since": "2024-06-01",
    "current_plan": "Growth",
    "current_arr": 24000
  }' \
  --wait

# Check with product usage context
clay fire expansion-signals \
  --data '{
    "company_domain": "customer.com",
    "current_plan": "Starter",
    "monthly_active_users": 45,
    "usage_limit_pct": 87,
    "last_login_days_ago": 2
  }' \
  --wait

# Check for cross-sell signals (different product line)
clay fire expansion-signals \
  --data '{
    "company_domain": "customer.com",
    "current_products": ["core_platform"],
    "available_products": ["analytics_addon", "ai_module", "enterprise_security"],
    "customer_since": "2023-01-01"
  }' \
  --wait
```

## output

```json
{
  "success": true,
  "table": "expansion-signals",
  "data": {
    "company": "CustomerCo",
    "domain": "customer.com",
    "expansion_score": 83,
    "expansion_tier": "A",
    "signals": {
      "headcount_growth": true,
      "headcount_growth_pct": 34,
      "recent_funding": true,
      "funding_amount_usd": 20000000,
      "new_office": false,
      "executive_hire": true,
      "new_executive_title": "VP of Engineering",
      "product_usage_near_limit": true,
      "usage_limit_pct": 87,
      "new_product_launch": false,
      "hiring_for_target_persona": true,
      "open_roles_count": 8
    },
    "expansion_type": "tier_upgrade",
    "recommended_expansion": "Enterprise plan",
    "estimated_expansion_arr": 60000,
    "expansion_angle": "CustomerCo raised a $20M Series B and just hired a VP of Eng — team is growing fast and they're at 87% of their user limit. Perfect time to discuss the Enterprise plan.",
    "best_contact": {
      "name": "Jane Smith",
      "title": "Head of Operations",
      "email": "jane@customer.com",
      "relationship": "main_champion"
    },
    "recommended_action": "cs_reach_out_this_week",
    "urgency": "high"
  }
}
```

Expansion tiers:
- **A (75-100)**: Reach out this week — high growth + near limit
- **B (50-74)**: Reach out this month — moderate signals
- **C (25-49)**: Monitor — some signals but not urgent
- **D (<25)**: No expansion signal

## clay table setup

1. Trigger: **Webhook**
2. Steps:
   - Company Enrichment (current employee count vs. baseline)
   - News Trigger lookup (funding, launches, hires)
   - Job Postings lookup (hiring signal)
   - Product Usage data (pass in via webhook or HTTP lookup)
   - AI scoring column (synthesize all signals → expansion score)
   - Champion contact lookup (find CS or account owner's primary contact)
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Weekly scan of customer base for expansion opportunities
cat customers.json | jq -c '.[]' | while read customer; do
  clay fire expansion-signals --data "$customer" --wait \
    | jq 'select(.data.expansion_tier == "A") | {
        company: .data.company,
        score: .data.expansion_score,
        type: .data.expansion_type,
        arr_opportunity: .data.estimated_expansion_arr,
        angle: .data.expansion_angle
      }'
done

# Filter for near-limit customers (usage-triggered expansion)
clay fire expansion-signals \
  --data '{"company_domain":"customer.com","usage_limit_pct":87,"current_plan":"Growth"}' \
  --wait | jq 'select(.data.signals.product_usage_near_limit == true) | .data.expansion_angle'

# Get CS outreach angle
clay fire expansion-signals \
  --data '{"company_domain":"customer.com","customer_since":"2024-01-01"}' \
  --wait | jq -r '.data.expansion_angle'

# Calculate total expansion pipeline from signal sweep
cat customers.json | jq -c '.[]' | while read customer; do
  clay fire expansion-signals --data "$customer" --wait \
    | jq 'select(.data.expansion_tier == "A" or .data.expansion_tier == "B") | .data.estimated_expansion_arr'
done | awk '{sum += $1} END {print "Total expansion pipeline: $" sum}'
```

## row limit

```bash
clay usage show expansion-signals
clay tables reset expansion-signals --webhook-url https://app.clay.com/webhook/NEW_ID
```
