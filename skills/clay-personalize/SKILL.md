# clay-personalize — AI-Powered Personalization at Scale

Generate highly personalized email first lines, subject lines, and LinkedIn connection notes using enriched prospect data. Each message references something specific about the person's role, company, recent news, or tech stack — not generic AI copy.

## install

```bash
npm install -g clay-cli
brew install cloudflared
clay tables add \
  --name personalize \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "AI personalization — first lines, subjects, LinkedIn notes from enrichment data"
clay listen start
```

## commands

```bash
# Generate personalization from LinkedIn URL
clay fire personalize \
  --data '{
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "my_product": "RevOps automation platform",
    "my_value_prop": "eliminate manual CRM updates for RevOps teams",
    "sequence_type": "cold_email"
  }' \
  --wait

# Generate from pre-enriched data (faster — no re-enrichment)
clay fire personalize \
  --data '{
    "first_name": "Jane",
    "title": "VP Revenue Operations",
    "company": "Stripe",
    "company_funding_stage": "Series I",
    "tech_stack": ["Salesforce", "Gong", "Outreach"],
    "recent_news": "Stripe raised $694M Series I",
    "my_product": "RevOps automation",
    "sequence_type": "cold_email"
  }' \
  --wait

# LinkedIn connection note
clay fire personalize \
  --data '{
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "my_product": "Sales intelligence platform",
    "sequence_type": "linkedin_connect"
  }' \
  --wait

# Follow-up after no reply
clay fire personalize \
  --data '{
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "previous_email_subject": "Quick question on RevOps tooling",
    "days_since_sent": 5,
    "my_product": "RevOps automation",
    "sequence_type": "followup_email"
  }' \
  --wait
```

## output

```json
{
  "success": true,
  "table": "personalize",
  "data": {
    "first_name": "Jane",
    "company": "Stripe",
    "personalization_inputs": {
      "trigger_used": "recent_funding",
      "trigger_detail": "Series I raise at $65B valuation"
    },
    "email_first_line": "Congrats on the Series I — that's a massive milestone. As Stripe scales the RevOps function globally, I imagine keeping CRM data clean across a distributed sales team gets harder fast.",
    "email_subject_lines": [
      "Quick question post-Series I",
      "RevOps at scale — after your raise",
      "Congrats Jane — one thought on CRM hygiene"
    ],
    "linkedin_connect_note": "Jane — huge congrats on the CRO role at Stripe. I work with RevOps leaders at similar-stage companies on reducing manual CRM work. Would love to connect.",
    "followup_line": "Jane — just circling back. Noticed Stripe just opened 3 RevOps roles, which usually means the team is feeling the data hygiene pain. Happy to show you what others your size are doing.",
    "personalization_score": 92,
    "personalization_type": "funding_trigger"
  }
}
```

Personalization types (what Clay's AI used as context):
- `funding_trigger` — Recent funding round
- `job_change` — Recently started the role
- `tech_stack` — References their specific tools
- `news_event` — Recent company news
- `hiring_signal` — Company is hiring in relevant area
- `generic_role` — Role + company only (weakest, use as fallback)

## clay table setup

1. Trigger: **Webhook**
2. Steps:
   - Person Enrichment (get title, company, bio, tenure)
   - Company Enrichment (funding, size, news, tech stack)
   - News Trigger lookup (last 60 days)
   - Job Change Detection
   - AI Personalization column (prompt: "Given this prospect data and my product value prop, write a personalized cold email first line that references something specific and recent...")
   - AI Subject Line generation (3 options)
   - AI LinkedIn Connect note
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Get the best subject line
clay fire personalize \
  --data '{"linkedin_url":"https://linkedin.com/in/jdoe","my_product":"Sales AI","sequence_type":"cold_email"}' \
  --wait | jq -r '.data.email_subject_lines[0]'

# Get first line + subject together for email assembly
RESULT=$(clay fire personalize \
  --data '{"linkedin_url":"https://linkedin.com/in/jdoe","my_product":"RevOps automation","my_value_prop":"reduce manual CRM updates","sequence_type":"cold_email"}' \
  --wait)

FIRST_LINE=$(echo $RESULT | jq -r '.data.email_first_line')
SUBJECT=$(echo $RESULT | jq -r '.data.email_subject_lines[0]')
FNAME=$(echo $RESULT | jq -r '.data.first_name')

echo "To: $FNAME"
echo "Subject: $SUBJECT"
echo "Opening: $FIRST_LINE"

# Batch personalize a list
cat leads.json | jq -c '.[]' | while read lead; do
  clay fire personalize \
    --data "$(echo $lead | jq '. + {"my_product":"Your Product","sequence_type":"cold_email"}')" \
    --wait \
    | jq '{name: .data.first_name, company: .data.company, subject: .data.email_subject_lines[0], first_line: .data.email_first_line}'
done

# Check personalization quality score before sending
clay fire personalize \
  --data '{"linkedin_url":"https://linkedin.com/in/jdoe","my_product":"X","sequence_type":"cold_email"}' \
  --wait | jq 'select(.data.personalization_score >= 75) | .data'
```

## row limit

```bash
clay usage show personalize
clay tables reset personalize --webhook-url https://app.clay.com/webhook/NEW_ID
```
