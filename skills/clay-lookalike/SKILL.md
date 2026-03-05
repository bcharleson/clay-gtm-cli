# clay-lookalike — Find Lookalike Prospects from Best Customers

Takes your best customers as input and finds prospects that match the same profile: similar company size, industry, tech stack, growth signals, and persona seniority. This is the highest-converting prospecting method — you're finding companies that look exactly like the ones already getting value.

## install

```bash
npm install -g clay-cli
brew install cloudflared
clay tables add \
  --name lookalike \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Lookalike prospecting from best customer profiles"
clay listen start
```

## commands

```bash
# Find lookalikes from a single customer domain
clay fire lookalike \
  --data '{
    "seed_domain": "bestcustomer.com",
    "limit": 50
  }' \
  --wait --timeout 300

# Find lookalikes from multiple seed customers (stronger signal)
clay fire lookalike \
  --data '{
    "seed_domains": ["customer1.com", "customer2.com", "customer3.com"],
    "limit": 100,
    "exclude_domains": ["existingcustomer.com", "competitor.com"]
  }' \
  --wait --timeout 300

# Find lookalikes with specific persona filter
clay fire lookalike \
  --data '{
    "seed_domains": ["stripe.com", "plaid.com"],
    "target_titles": ["Head of RevOps", "VP Revenue Operations"],
    "limit": 75
  }' \
  --wait --timeout 300

# Lookalike with match score threshold
clay fire lookalike \
  --data '{
    "seed_domains": ["customer1.com", "customer2.com"],
    "min_match_score": 75,
    "limit": 50
  }' \
  --wait --timeout 300
```

## output

```json
{
  "success": true,
  "table": "lookalike",
  "data": {
    "seeds_analyzed": 3,
    "seed_profile": {
      "avg_employee_count": 320,
      "industries": ["SaaS", "FinTech"],
      "common_tech": ["Salesforce", "Gong", "Outreach"],
      "funding_stages": ["Series B", "Series C"],
      "top_persona_titles": ["VP RevOps", "Head of Sales"]
    },
    "lookalikes_found": 48,
    "lookalikes": [
      {
        "company": "GrowthCo",
        "domain": "growthco.com",
        "match_score": 91,
        "match_reasons": ["similar_size", "same_industry", "uses_salesforce", "series_b"],
        "employee_count": 290,
        "funding_stage": "Series B",
        "champion_contact": {
          "name": "Alex Rivera",
          "title": "VP Revenue Operations",
          "linkedin_url": "https://linkedin.com/in/arivera",
          "email": "alex@growthco.com",
          "email_verified": true
        }
      }
    ]
  }
}
```

## clay table setup

1. Trigger: **Webhook**
2. Steps:
   - Seed Company Enrichment (build profile from seed domains)
   - Lookalike Search (Apollo/Clay search using derived filters)
   - Exclude existing customers/prospects (HTTP lookup against CRM)
   - Champion Contact Finder (search LinkedIn for matching persona at each company)
   - Email Finder for champion contacts
   - Match Score calculation (AI column)
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Find lookalikes and only take high-match companies
clay fire lookalike \
  --data '{"seed_domains":["stripe.com","plaid.com"],"limit":100}' \
  --wait --timeout 300 \
  | jq '.data.lookalikes[] | select(.match_score >= 80)'

# Extract all champion contacts ready for outreach
clay fire lookalike \
  --data '{"seed_domains":["best_customer.com"],"target_titles":["CRO","VP Sales"],"limit":50}' \
  --wait --timeout 300 \
  | jq '.data.lookalikes[] | select(.champion_contact.email_verified) | .champion_contact'

# Get match reasons for personalization angle
clay fire lookalike \
  --data '{"seed_domains":["customer1.com","customer2.com"],"limit":25}' \
  --wait --timeout 300 \
  | jq '.data.lookalikes[] | {company: .company, score: .match_score, reasons: .match_reasons}'

# Monthly ICP refresh — rebuild lookalike list from new customers
# Pipe results into outbound-prep for full enrichment
clay fire lookalike \
  --data '{"seed_domains":["cust1.com","cust2.com","cust3.com"],"limit":100}' \
  --wait --timeout 300 \
  | jq -r '.data.lookalikes[].champion_contact.linkedin_url' \
  | while read url; do
      clay fire outbound-prep --data "{\"linkedin_url\":\"$url\"}" --wait --timeout 240
    done
```

## row limit

```bash
clay usage show lookalike
clay tables reset lookalike --webhook-url https://app.clay.com/webhook/NEW_ID
```
