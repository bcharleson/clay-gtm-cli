# clay-account-research — Account-Based Marketing (ABM) Research

Deep-dive research on a target account: company overview, buying committee members, tech stack, recent news and triggers, open roles, competitor relationships, and a recommended engagement strategy. Use for ABM targeting, account planning, and executive outreach.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared
clay tables add \
  --name account-research \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "ABM account research — buying committee, triggers, tech stack, strategy"
clay listen start
```

## commands

```bash
# Full account research by domain
clay fire account-research \
  --data '{"domain": "stripe.com"}' \
  --wait --timeout 240

# Research with known contact as entry point
clay fire account-research \
  --data '{"domain": "stripe.com", "primary_contact_linkedin": "https://linkedin.com/in/jdoe"}' \
  --wait --timeout 240

# Lightweight account snapshot (faster, fewer enrichment steps)
clay fire account-research \
  --data '{"domain": "acme.com", "mode": "snapshot"}' \
  --wait --timeout 120
```

## output

```json
{
  "success": true,
  "table": "account-research",
  "data": {
    "company_name": "Stripe",
    "domain": "stripe.com",
    "industry": "Financial Technology",
    "employee_count": 8500,
    "hq": "San Francisco, CA",
    "funding_stage": "Series I",
    "total_funding_usd": 2200000000,
    "annual_revenue_range": "$1B-$5B",
    "tech_stack": ["AWS", "Salesforce", "Outreach", "Gong", "Looker"],
    "buying_committee": [
      {
        "name": "John Doe",
        "title": "VP of Revenue Operations",
        "linkedin_url": "https://linkedin.com/in/jdoe",
        "email": "john@stripe.com",
        "is_decision_maker": true,
        "is_champion_candidate": true
      },
      {
        "name": "Jane Smith",
        "title": "Head of Sales Enablement",
        "linkedin_url": "https://linkedin.com/in/jsmith",
        "email": "jane@stripe.com",
        "is_decision_maker": false,
        "is_champion_candidate": true
      }
    ],
    "recent_news": [
      "Stripe raised $694M Series I at $65B valuation",
      "Stripe expanded into Southeast Asia markets"
    ],
    "hiring_signals": {
      "is_hiring": true,
      "open_roles": 142,
      "hiring_for_revops": true,
      "hiring_for_sales": true
    },
    "intent_signals": ["visited_pricing_page", "downloaded_case_study"],
    "competitor_tools": ["Braintree", "Adyen"],
    "engagement_strategy": "Multi-thread: lead with VP RevOps (champion) + loop in Head of Enablement. Lead angle: scaling RevOps tooling to support their SE Asia expansion.",
    "account_tier": "A",
    "abm_priority": "tier_1"
  }
}
```

## clay table setup

In your Clay table:
1. Trigger: **Webhook**
2. Steps:
   - Company Enrichment (domain → full profile)
   - LinkedIn Company Scrape (buying committee members by title)
   - Email Finding (for each buying committee member)
   - News Scraper (recent company news via Google/Clay web scraper)
   - Job Postings Lookup (open roles → hiring signals)
   - Tech Stack (BuiltWith)
   - AI column: generate `engagement_strategy` from all signals
   - AI column: assign `account_tier` (A/B/C)
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Research an account and extract just the buying committee
clay fire account-research \
  --data '{"domain": "acme.com"}' \
  --wait --timeout 240 \
  | jq '.data.buying_committee[] | select(.is_decision_maker == true) | {name: .name, title: .title, email: .email}'

# Get the recommended engagement strategy
clay fire account-research \
  --data '{"domain": "growthco.com"}' \
  --wait --timeout 240 \
  | jq -r '.data.engagement_strategy'

# Check if account uses a competitor tool (displacement opportunity)
clay fire account-research \
  --data '{"domain": "target.com"}' \
  --wait | jq '.data.competitor_tools'

# Research + filter to Tier 1 accounts only
clay fire account-research \
  --data '{"domain": "acme.com"}' \
  --wait | jq 'select(.data.account_tier == "A") | .data'

# Batch research a list of target domains
cat target_accounts.txt | while read domain; do
  echo "Researching $domain..."
  clay fire account-research \
    --data "{\"domain\": \"$domain\"}" \
    --wait --timeout 240 \
    | jq '{
        company: .data.company_name,
        tier: .data.account_tier,
        decision_makers: [.data.buying_committee[] | select(.is_decision_maker) | .name],
        strategy: .data.engagement_strategy
      }'
done

# Multi-thread: research + immediately prep the champion contact
ACCOUNT=$(clay fire account-research --data '{"domain": "acme.com"}' --wait --timeout 240)
CHAMPION_URL=$(echo $ACCOUNT | jq -r '.data.buying_committee[] | select(.is_champion_candidate == true) | .linkedin_url' | head -1)

clay fire outbound-prep \
  --data "{\"linkedin_url\": \"$CHAMPION_URL\"}" \
  --wait --timeout 180
```

## account tier definitions

| Tier | Criteria | Action |
|------|----------|--------|
| A | Perfect ICP fit + active signals | Full ABM play, multi-thread |
| B | Good ICP fit + some signals | Standard multi-thread outreach |
| C | Partial fit | Single-thread, lower cadence |
| D | Poor fit | Do not pursue |

## row limit

```bash
clay usage show account-research
clay tables reset account-research --webhook-url https://app.clay.com/webhook/NEW_ID
```
