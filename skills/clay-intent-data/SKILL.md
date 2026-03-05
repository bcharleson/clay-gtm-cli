# clay-intent-data — Buyer Intent Signal Enrichment

Enrich a company or prospect with third-party intent signals: G2 category research, Bombora topic surges, review activity, competitor comparisons, and pricing page visits. Use to identify companies actively researching your category right now — timing makes these the highest-converting prospects.

## install

```bash
npm install -g clay-cli
brew install cloudflared
clay tables add \
  --name intent-data \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Intent data enrichment — G2, Bombora, review activity, competitor research"
clay listen start
```

## commands

```bash
# Check intent signals for a company domain
clay fire intent-data \
  --data '{"domain": "acme.com"}' \
  --wait

# Check intent with your specific category context
clay fire intent-data \
  --data '{
    "domain": "acme.com",
    "category": "Revenue Intelligence",
    "competitor_names": ["Competitor A", "Competitor B"]
  }' \
  --wait

# Check intent for a person (resolves to company)
clay fire intent-data \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait
```

## output

```json
{
  "success": true,
  "table": "intent-data",
  "data": {
    "domain": "acme.com",
    "company": "Acme Corp",
    "intent_score": 84,
    "intent_level": "high",
    "signals": {
      "g2_category_research": true,
      "g2_last_active": "2026-02-28",
      "g2_pages_viewed": 12,
      "g2_compared_competitors": ["Competitor A", "Competitor B"],
      "bombora_surging": true,
      "bombora_topics": ["Sales Automation", "Revenue Operations", "CRM Integration"],
      "bombora_surge_score": 78,
      "visited_pricing": true,
      "visited_pricing_last": "2026-03-01",
      "requested_demo": false,
      "viewed_case_studies": true,
      "review_activity": "posted_review_on_g2"
    },
    "in_market_window": true,
    "recommended_action": "immediate_outreach",
    "outreach_angle": "They've been comparing you vs Competitor A on G2 for 2 weeks and just hit your pricing page — they're close to a decision."
  }
}
```

Intent levels:
- `high` (75-100): In active evaluation — reach out today
- `medium` (50-74): Researching category — reach out this week
- `low` (25-49): Early awareness — add to nurture
- `none` (<25): No signal detected

## clay table setup

1. Trigger: **Webhook**
2. Steps:
   - G2 Buyer Intent lookup (if G2 integration enabled)
   - Bombora Intent data (if Bombora integration enabled)
   - Website Visitor data (IP enrichment via Clearbit/RB2B)
   - Review Activity scraper
   - AI column: synthesize `intent_score` + `outreach_angle` from all signals
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Only act on high-intent companies
clay fire intent-data \
  --data '{"domain": "acme.com", "category": "Sales Intelligence"}' \
  --wait | jq 'select(.data.intent_level == "high") | .data'

# Get the outreach angle for personalization
clay fire intent-data \
  --data '{"domain": "growthco.com"}' \
  --wait | jq -r '.data.outreach_angle'

# Check if they've compared you to a specific competitor
clay fire intent-data \
  --data '{"domain": "acme.com", "competitor_names": ["CompetitorX"]}' \
  --wait | jq 'select(.data.signals.g2_compared_competitors | contains(["CompetitorX"]))'

# Weekly intent sweep — scan target account list
cat target_accounts.txt | while read domain; do
  clay fire intent-data \
    --data "{\"domain\": \"$domain\", \"category\": \"Your Category\"}" \
    --wait \
    | jq 'select(.data.intent_level == "high") | {company: .data.company, score: .data.intent_score, angle: .data.outreach_angle}'
done

# Combine intent + outbound prep for high-signal leads
DOMAIN="highintent.com"
INTENT=$(clay fire intent-data --data "{\"domain\":\"$DOMAIN\"}" --wait)
INTENT_SCORE=$(echo $INTENT | jq -r '.data.intent_score')

if [ "$INTENT_SCORE" -ge 75 ]; then
  CHAMPION=$(echo $INTENT | jq -r '.data.champion_linkedin_url // empty')
  clay fire outbound-prep \
    --data "{\"linkedin_url\":\"$CHAMPION\",\"intent_context\":\"High G2 intent score $INTENT_SCORE\"}" \
    --wait --timeout 240
fi
```

## row limit

```bash
clay usage show intent-data
clay tables reset intent-data --webhook-url https://app.clay.com/webhook/NEW_ID
```
