# clay-outbound-prep — Full Outbound Lead Preparation

Run a complete pre-outreach enrichment pipeline for a lead: enrich profile, find and validate email, score against ICP, and generate a personalized first-line. Returns everything needed to add a lead to a sequence in one call.

This is the highest-value GTM workflow — one webhook fires, Clay runs the full waterfall, and you get back a sequence-ready lead.

## install

```bash
npm install -g clay-cli
brew install cloudflared
clay tables add \
  --name outbound-prep \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Full outbound prep — enrich + email + score + first-line"
clay listen start
```

## commands

```bash
# Full prep from LinkedIn URL (most common)
clay fire outbound-prep \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait --timeout 180

# Prep from name + company domain
clay fire outbound-prep \
  --data '{"first_name": "Jane", "last_name": "Smith", "company_domain": "stripe.com"}' \
  --wait --timeout 180

# Include custom context for the AI first-line
clay fire outbound-prep \
  --data '{
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "my_product": "RevOps automation platform",
    "my_use_case": "reduce manual CRM updates for RevOps teams"
  }' \
  --wait --timeout 240
```

## output

```json
{
  "success": true,
  "table": "outbound-prep",
  "data": {
    "first_name": "John",
    "last_name": "Doe",
    "full_name": "John Doe",
    "title": "VP of Revenue Operations",
    "company": "Acme Corp",
    "company_domain": "acme.com",
    "employee_count": 450,
    "industry": "SaaS",
    "funding_stage": "Series C",
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "email": "john@acme.com",
    "email_verified": true,
    "email_confidence": 0.96,
    "icp_score": 91,
    "icp_tier": "A",
    "job_changed_recently": false,
    "tech_stack": ["Salesforce", "Outreach", "Gong"],
    "ai_first_line": "Noticed Acme just closed their Series C — congrats. As you scale the RevOps function, curious if manual CRM hygiene is a growing pain.",
    "sequence_ready": true,
    "skip_reason": null
  }
}
```

`sequence_ready: false` cases (with `skip_reason`):
- `"no_verified_email"` — waterfall found nothing
- `"icp_tier_d"` — scored too low, not worth contacting
- `"unsubscribed"` — on suppression list
- `"competitor_employee"` — works at a competitor

## clay table setup

In your Clay table:
1. Trigger: **Webhook**
2. Steps (in order):
   - Person Enrichment (LinkedIn)
   - Company Enrichment (Clearbit / Apollo)
   - Waterfall Email Finder (Hunter → Apollo → RocketReach → Clearbit)
   - Email Validator
   - ICP Scoring (AI column or formula)
   - Suppression List Check (HTTP lookup)
   - AI First-Line Generator (use `title`, `company`, `tech_stack`, `recent_news` as context)
3. Final step: **HTTP API** → POST to `{{_callback_url}}` with all output columns

## common patterns

```bash
# Full prep — only use if sequence_ready
RESULT=$(clay fire outbound-prep \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait --timeout 240)

READY=$(echo $RESULT | jq -r '.data.sequence_ready')
if [ "$READY" = "true" ]; then
  EMAIL=$(echo $RESULT | jq -r '.data.email')
  FIRST_LINE=$(echo $RESULT | jq -r '.data.ai_first_line')
  echo "Email: $EMAIL"
  echo "First line: $FIRST_LINE"
else
  REASON=$(echo $RESULT | jq -r '.data.skip_reason')
  echo "Skipped: $REASON"
fi

# Batch prep a list of LinkedIn URLs
cat linkedin_urls.txt | while read url; do
  clay fire outbound-prep \
    --data "{\"linkedin_url\": \"$url\"}" \
    --wait --timeout 240 \
    | jq 'select(.data.sequence_ready == true) | .data | {email: .email, first_line: .ai_first_line, tier: .icp_tier}'
done

# Prep and filter for A-tier only
clay fire outbound-prep \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait | jq 'select(.data.icp_tier == "A") | .data'

# Get just the first-line for copy review
clay fire outbound-prep \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait | jq -r '.data.ai_first_line'

# Check usage before a large batch
clay usage show outbound-prep --pretty
```

## timeout guidance

This table runs multiple enrichment steps. Recommended timeouts:
- LinkedIn only: `--timeout 60`
- LinkedIn + email: `--timeout 120`
- Full pipeline with AI: `--timeout 240`

## row limit

```bash
clay usage show outbound-prep
clay tables reset outbound-prep --webhook-url https://app.clay.com/webhook/NEW_ID
```
