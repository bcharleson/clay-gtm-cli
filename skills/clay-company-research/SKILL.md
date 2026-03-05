# clay-company-research — Company Enrichment + Tech Stack

Enrich a company by domain or name to get employee count, industry, funding stage, revenue range, tech stack, social profiles, HQ location, and key decision makers. Use for account qualification and ABM targeting.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared
clay tables add \
  --name company-research \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Company enrichment — size, funding, tech stack, decision makers"
clay listen start
```

## commands

```bash
# Research by domain (most reliable)
clay fire company-research \
  --data '{"domain": "stripe.com"}' \
  --wait

# Research by company name
clay fire company-research \
  --data '{"company_name": "Notion Labs"}' \
  --wait

# Research with LinkedIn company URL
clay fire company-research \
  --data '{"linkedin_company_url": "https://linkedin.com/company/stripe"}' \
  --wait

# Research multiple companies (loop)
for domain in stripe.com notion.so linear.app; do
  clay fire company-research --data "{\"domain\": \"$domain\"}" --wait --pretty
done
```

## output

```json
{
  "success": true,
  "table": "company-research",
  "data": {
    "company_name": "Stripe",
    "domain": "stripe.com",
    "industry": "Financial Technology",
    "employee_count": 8500,
    "employee_range": "5001-10000",
    "founded_year": 2010,
    "hq_city": "San Francisco",
    "hq_country": "United States",
    "funding_stage": "Series I",
    "total_funding_usd": 2200000000,
    "annual_revenue_range": "$1B-$5B",
    "tech_stack": ["AWS", "React", "Ruby on Rails", "Stripe API"],
    "linkedin_url": "https://linkedin.com/company/stripe",
    "description": "Financial infrastructure for the internet",
    "is_hiring": true,
    "open_roles": 142
  }
}
```

## clay table setup

In your Clay table:
1. Trigger: **Webhook**
2. Steps: Company Enrichment (Clearbit/Apollo/LinkedIn), Tech Stack Lookup (BuiltWith/Wappalyzer), Funding Data (Crunchbase)
3. Final step: **HTTP API** → POST to `{{_callback_url}}` with enriched company columns

## common patterns

```bash
# Qualify a company for ICP fit (B2B SaaS, 50-500 employees)
clay fire company-research \
  --data '{"domain": "notion.so"}' \
  --wait | jq 'select(.data.employee_count >= 50 and .data.employee_count <= 500)'

# Get tech stack to personalize outreach
TECH=$(clay fire company-research \
  --data '{"domain": "acme.com"}' \
  --wait | jq -r '.data.tech_stack[]')
echo "They use: $TECH"

# Check if company is actively hiring (a strong buying signal)
clay fire company-research \
  --data '{"domain": "growthco.com"}' \
  --wait | jq '{company: .data.company_name, hiring: .data.is_hiring, open_roles: .data.open_roles}'

# Batch research a list of domains
cat target_accounts.txt | while read domain; do
  clay fire company-research --data "{\"domain\": \"$domain\"}" --wait \
    | jq '{domain: .data.domain, employees: .data.employee_count, stage: .data.funding_stage}'
done

# Research + check if they use a competitor
clay fire company-research \
  --data '{"domain": "competitor-customer.com"}' \
  --wait | jq '.data.tech_stack | map(select(test("Salesforce|HubSpot|Outreach"; "i")))'
```

## row limit

```bash
clay usage show company-research
clay tables reset company-research --webhook-url https://app.clay.com/webhook/NEW_ID
```
