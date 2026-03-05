# clay-icp-score — ICP Qualification Scoring

Score a lead or account against your Ideal Customer Profile (ICP). Returns a fit score and signal breakdown so you can prioritize outreach. Combines company size, industry, tech stack, funding, and persona seniority signals.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared
clay tables add \
  --name icp-score \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "ICP scoring — returns fit score + signal breakdown"
clay listen start
```

## commands

```bash
# Score a lead by LinkedIn URL (person + company enriched in Clay)
clay fire icp-score \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait

# Score by domain (account-level only)
clay fire icp-score \
  --data '{"domain": "acme.com"}' \
  --wait

# Score with pre-enriched data (faster, skips re-enrichment)
clay fire icp-score \
  --data '{
    "first_name": "Jane",
    "last_name": "Smith",
    "title": "Head of Revenue Operations",
    "company": "Acme Corp",
    "domain": "acme.com",
    "employee_count": 350,
    "industry": "SaaS",
    "funding_stage": "Series B"
  }' \
  --wait
```

## output

```json
{
  "success": true,
  "table": "icp-score",
  "data": {
    "icp_score": 87,
    "icp_tier": "A",
    "signals": {
      "company_size_fit": true,
      "industry_fit": true,
      "funding_stage_fit": true,
      "persona_fit": true,
      "tech_stack_fit": false,
      "hiring_signal": true
    },
    "score_breakdown": {
      "company_size": 20,
      "industry": 20,
      "funding_stage": 15,
      "persona_seniority": 20,
      "tech_stack": 0,
      "hiring_signal": 12
    },
    "recommended_action": "high_priority_outreach",
    "notes": "Series B SaaS, RevOps leader, actively hiring SDRs — strong buying signal"
  }
}
```

ICP tiers:
- **A (80-100)**: Immediate outreach — high-priority
- **B (60-79)**: Good fit — standard sequence
- **C (40-59)**: Marginal fit — nurture only
- **D (<40)**: Poor fit — do not contact

## clay table setup

In your Clay table:
1. Trigger: **Webhook**
2. Steps: Person Enrichment, Company Enrichment, AI scoring formula (use Clay's AI column or conditional scoring columns), Tier assignment
3. Final step: **HTTP API** → POST to `{{_callback_url}}` with `icp_score`, `icp_tier`, `signals`, `recommended_action`

## common patterns

```bash
# Only return A-tier leads
clay fire icp-score \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait | jq 'select(.data.icp_tier == "A")'

# Score and route to correct sequence
RESULT=$(clay fire icp-score \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' --wait)
TIER=$(echo $RESULT | jq -r '.data.icp_tier')

case $TIER in
  A) echo "Add to high-touch sequence" ;;
  B) echo "Add to automated sequence" ;;
  C) echo "Add to nurture" ;;
  D) echo "Skip" ;;
esac

# Batch score a list and filter for A+B only
cat prospects.json | jq -c '.[]' | while read lead; do
  clay fire icp-score --data "$lead" --wait \
    | jq 'select(.data.icp_tier == "A" or .data.icp_tier == "B") | .data'
done

# Get score breakdown to understand why a lead scored low
clay fire icp-score \
  --data '{"domain": "somecompany.com", "linkedin_url": "https://linkedin.com/in/janedoe"}' \
  --wait --pretty | jq '.data.score_breakdown'
```

## row limit

```bash
clay usage show icp-score
clay tables reset icp-score --webhook-url https://app.clay.com/webhook/NEW_ID
```
