# clay-news-trigger — Company News + Funding Trigger Detection

Monitor companies for trigger events: new funding rounds, executive hires, product launches, expansions, awards, partnerships, and press coverage. Trigger events create natural outreach windows — a "congrats" message after a funding announcement converts 3-5x better than cold outreach.

## install

```bash
npm install -g clay-cli
brew install cloudflared
clay tables add \
  --name news-trigger \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Company news and trigger event detection — funding, hires, launches, expansions"
clay listen start
```

## commands

```bash
# Get all recent news + triggers for a company
clay fire news-trigger \
  --data '{"domain": "stripe.com"}' \
  --wait

# Check specific trigger types
clay fire news-trigger \
  --data '{
    "domain": "acme.com",
    "lookback_days": 30,
    "trigger_types": ["funding", "executive_hire", "product_launch", "expansion"]
  }' \
  --wait

# Check with your product context (AI tailors the outreach angle)
clay fire news-trigger \
  --data '{
    "domain": "growthco.com",
    "my_product_context": "RevOps automation platform",
    "lookback_days": 60
  }' \
  --wait
```

## output

```json
{
  "success": true,
  "table": "news-trigger",
  "data": {
    "domain": "growthco.com",
    "company": "GrowthCo",
    "has_triggers": true,
    "trigger_count": 2,
    "triggers": [
      {
        "type": "funding",
        "title": "GrowthCo raises $45M Series B",
        "summary": "GrowthCo announced a $45M Series B led by Accel Partners to expand their sales automation platform",
        "date": "2026-02-18",
        "days_ago": 15,
        "source_url": "https://techcrunch.com/...",
        "outreach_angle": "Congrats on the Series B! As you scale the team post-raise, curious if RevOps tooling is on the roadmap.",
        "urgency": "high"
      },
      {
        "type": "executive_hire",
        "title": "GrowthCo hires new VP of Revenue Operations",
        "summary": "Jane Smith joins as VP RevOps from Salesforce",
        "date": "2026-02-25",
        "days_ago": 8,
        "new_hire_linkedin": "https://linkedin.com/in/jsmith",
        "outreach_angle": "Jane — saw you recently joined GrowthCo as VP RevOps. Congrats on the new role! Given what you're likely inheriting...",
        "urgency": "high"
      }
    ],
    "best_trigger": "funding",
    "recommended_action": "reach_out_today"
  }
}
```

Trigger types:
- `funding` — Series A/B/C/D, seed round
- `executive_hire` — New C-suite, VP, or Director joins
- `product_launch` — New product or major feature announcement
- `expansion` — New market, new office, international expansion
- `partnership` — Strategic partnership or integration
- `award` — Industry award or recognition
- `ipo_filing` — S-1 filing or IPO announcement
- `acquisition` — Bought or was acquired

## clay table setup

1. Trigger: **Webhook**
2. Steps:
   - Google News Scraper (company name + recent news)
   - Crunchbase/Tracxn Funding lookup
   - LinkedIn Company Feed scraper (new hires, announcements)
   - PR Newswire / Globe Newswire lookup
   - AI column: classify each news item into trigger type
   - AI column: generate `outreach_angle` per trigger
   - Priority/urgency scoring (recency + type)
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Only show high-urgency triggers from the last 30 days
clay fire news-trigger \
  --data '{"domain": "acme.com", "lookback_days": 30}' \
  --wait \
  | jq '.data.triggers[] | select(.urgency == "high" and .days_ago <= 30)'

# Get best outreach angle for the most recent trigger
clay fire news-trigger \
  --data '{"domain": "acme.com"}' \
  --wait \
  | jq -r '.data.triggers | sort_by(.days_ago) | first | .outreach_angle'

# Weekly trigger sweep on target account list
cat target_accounts.txt | while read domain; do
  clay fire news-trigger \
    --data "{\"domain\": \"$domain\", \"lookback_days\": 7}" \
    --wait \
    | jq 'select(.data.has_triggers == true) | {company: .data.company, trigger: .data.best_trigger, angle: .data.triggers[0].outreach_angle}'
done

# Alert when a target company raises funding
clay fire news-trigger \
  --data '{"domain": "watchlist_company.com"}' \
  --wait \
  | jq 'select(.data.triggers[] | .type == "funding") | {company: .data.company, news: .data.triggers[0].title}'

# Combine trigger + champion contact for immediate outreach
RESULT=$(clay fire news-trigger --data '{"domain":"growthco.com"}' --wait)
if [ "$(echo $RESULT | jq -r '.data.has_triggers')" = "true" ]; then
  HIRE_LINKEDIN=$(echo $RESULT | jq -r '.data.triggers[] | select(.type == "executive_hire") | .new_hire_linkedin' | head -1)
  if [ -n "$HIRE_LINKEDIN" ]; then
    clay fire outbound-prep --data "{\"linkedin_url\":\"$HIRE_LINKEDIN\"}" --wait --timeout 240
  fi
fi
```

## row limit

```bash
clay usage show news-trigger
clay tables reset news-trigger --webhook-url https://app.clay.com/webhook/NEW_ID
```
