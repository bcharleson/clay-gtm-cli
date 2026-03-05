# clay-prospect-list — Build a Prospect List from Scratch

Build a targeted prospect list by combining filters: industry, company size, funding stage, job title, geography, and tech stack. Clay queries LinkedIn, Apollo, and other sources to return a fully enriched list ready for outbound.

Use this instead of manually building lists in Sales Navigator — the agent can build, enrich, and score in one shot.

## install

```bash
npm install -g clay-cli
brew install cloudflared
clay tables add \
  --name prospect-list \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Build prospect lists from filters — industry, size, title, geo, tech"
clay listen start
```

## commands

```bash
# Build a list by ICP filters
clay fire prospect-list \
  --data '{
    "industry": "SaaS",
    "employee_min": 50,
    "employee_max": 500,
    "funding_stages": ["Series A", "Series B", "Series C"],
    "titles": ["VP of Sales", "Head of Revenue", "CRO"],
    "locations": ["United States"],
    "limit": 50
  }' \
  --wait --timeout 300

# Filter by tech stack (use tech as a buying signal)
clay fire prospect-list \
  --data '{
    "tech_stack_includes": ["Salesforce", "Outreach"],
    "employee_min": 100,
    "titles": ["VP Revenue Operations", "Head of RevOps", "Director of RevOps"],
    "limit": 100
  }' \
  --wait --timeout 300

# Target companies that recently raised funding
clay fire prospect-list \
  --data '{
    "funding_raised_last_days": 90,
    "funding_stages": ["Series B", "Series C"],
    "titles": ["CRO", "VP Sales", "Chief Revenue Officer"],
    "employee_min": 100,
    "limit": 50
  }' \
  --wait --timeout 300

# Target a specific vertical
clay fire prospect-list \
  --data '{
    "industry": "Healthcare Technology",
    "employee_min": 200,
    "employee_max": 2000,
    "titles": ["VP Engineering", "CTO", "Head of Product"],
    "locations": ["United States", "Canada"],
    "limit": 75
  }' \
  --wait --timeout 300
```

## output

```json
{
  "success": true,
  "table": "prospect-list",
  "data": {
    "total_found": 47,
    "limit": 50,
    "prospects": [
      {
        "first_name": "Jane",
        "last_name": "Smith",
        "title": "VP of Sales",
        "company": "GrowthCo",
        "company_domain": "growthco.com",
        "employee_count": 280,
        "funding_stage": "Series B",
        "linkedin_url": "https://linkedin.com/in/jsmith",
        "email": "jane@growthco.com",
        "email_verified": true,
        "location": "Austin, TX",
        "icp_score": 88,
        "icp_tier": "A"
      }
    ],
    "breakdown": {
      "with_email": 41,
      "email_verified": 38,
      "icp_tier_a": 22,
      "icp_tier_b": 15
    }
  }
}
```

## clay table setup

1. Trigger: **Webhook**
2. Steps:
   - Apollo/LinkedIn Search (map filters from webhook payload to search params)
   - Loop through results → Person Enrichment per row
   - Waterfall Email Finder per person
   - ICP Scoring column
3. Final step: **HTTP API** → POST all rows as array to `{{_callback_url}}`

## common patterns

```bash
# Build list and extract only sequence-ready leads
clay fire prospect-list \
  --data '{"industry":"SaaS","titles":["VP Sales"],"employee_min":100,"limit":50}' \
  --wait --timeout 300 \
  | jq '.data.prospects[] | select(.email_verified == true and .icp_tier == "A")'

# Get just emails for import
clay fire prospect-list \
  --data '{"industry":"FinTech","titles":["CRO"],"employee_min":200,"limit":100}' \
  --wait --timeout 300 \
  | jq -r '.data.prospects[] | select(.email_verified) | .email'

# Get breakdown summary
clay fire prospect-list \
  --data '{"industry":"SaaS","employee_min":50,"limit":100}' \
  --wait --timeout 300 \
  | jq '.data.breakdown'

# Build list weekly via cron (save to file)
# Add to crontab: 0 8 * * MON ...
clay fire prospect-list \
  --data '{"industry":"SaaS","funding_raised_last_days":7,"titles":["VP Sales","CRO"],"limit":50}' \
  --wait --timeout 300 \
  > ~/gtm/weekly_new_funded_$(date +%Y%m%d).json
```

## row limit

```bash
clay usage show prospect-list
clay tables reset prospect-list --webhook-url https://app.clay.com/webhook/NEW_ID
```
