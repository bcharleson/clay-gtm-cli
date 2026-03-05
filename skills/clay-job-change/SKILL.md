# clay-job-change — Job Change + Hiring Signal Detection

Detect when a prospect has recently changed jobs, been promoted, or when their company is actively hiring. Job changes are one of the highest-intent buying signals in B2B — people who just started a new role are actively evaluating tools and building their stack.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared
clay tables add \
  --name job-change \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Job change detection + hiring signals"
clay listen start
```

## commands

```bash
# Check if a lead has recently changed jobs (LinkedIn URL)
clay fire job-change \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait

# Check job change + company hiring signals together
clay fire job-change \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe", "company_domain": "acme.com"}' \
  --wait

# Check for company hiring signals only (account-level)
clay fire job-change \
  --data '{"company_domain": "highgrowthco.com"}' \
  --wait
```

## output

```json
{
  "success": true,
  "table": "job-change",
  "data": {
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "full_name": "John Doe",
    "current_title": "VP of Sales",
    "current_company": "Acme Corp",
    "previous_title": "Director of Sales",
    "previous_company": "OldCo Inc",
    "job_changed": true,
    "job_change_date": "2026-01-15",
    "days_in_new_role": 49,
    "is_new_to_leadership": true,
    "is_promotion": false,
    "company_hiring": true,
    "company_open_roles": 23,
    "company_hiring_for_sales": true,
    "trigger_signal": "new_role_within_90_days",
    "recommended_action": "high_priority_outreach",
    "outreach_angle": "New to role — helping them build their stack"
  }
}
```

Signal definitions:
- `job_changed`: True if role changed in last 90 days
- `is_new_to_leadership`: True if this is their first VP/Director/C-suite role
- `trigger_signal`: `new_role_within_90_days`, `promotion`, `company_expansion`, `hiring_surge`
- `recommended_action`: `high_priority_outreach`, `standard_outreach`, `monitor`, `skip`

## clay table setup

In your Clay table:
1. Trigger: **Webhook**
2. Steps: LinkedIn Enrichment (get current + previous roles), Job Change Date calculation, Company Hiring Data (via LinkedIn or job board scraper), AI column to classify the trigger signal
3. Final step: **HTTP API** → POST to `{{_callback_url}}` with all signal columns

## common patterns

```bash
# Only alert on leads who changed jobs in the last 30 days
clay fire job-change \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait | jq 'select(.data.days_in_new_role <= 30)'

# Find newly promoted leaders (highest intent)
clay fire job-change \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait | jq 'select(.data.is_new_to_leadership == true) | .data'

# Generate a personalized outreach angle based on signal
RESULT=$(clay fire job-change --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' --wait)
ANGLE=$(echo $RESULT | jq -r '.data.outreach_angle')
DAYS=$(echo $RESULT | jq -r '.data.days_in_new_role')
echo "Message angle: $ANGLE (Day $DAYS in role)"

# Check if a company is on a hiring surge (expansion signal)
clay fire job-change \
  --data '{"company_domain": "hypergrowthco.com"}' \
  --wait | jq '{
    company: .data.current_company,
    hiring: .data.company_hiring,
    open_roles: .data.company_open_roles,
    signal: .data.trigger_signal
  }'

# Monitor a list of past customers for job changes (expansion into new accounts)
cat past_customers.json | jq -c '.[]' | while read lead; do
  clay fire job-change --data "$lead" --wait \
    | jq 'select(.data.job_changed == true) | {name: .data.full_name, new_company: .data.current_company}'
done
```

## row limit

```bash
clay usage show job-change
clay tables reset job-change --webhook-url https://app.clay.com/webhook/NEW_ID
```
