# clay-website-visitor — Website Visitor Deanonymization

Convert anonymous website visitors (IP addresses or visitor events) into identified companies and contact records. Find out which companies are visiting your site, what pages they viewed, and who the likely buyer is. Combine with outreach for warm, high-intent prospects.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared
clay tables add \
  --name website-visitor \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Deanonymize website visitors — IP to company + buyer contact"
clay listen start
```

## commands

```bash
# Deanonymize a visitor by IP address
clay fire website-visitor \
  --data '{"ip_address": "104.18.24.47"}' \
  --wait

# Enrich with page context (improves intent scoring)
clay fire website-visitor \
  --data '{
    "ip_address": "104.18.24.47",
    "pages_visited": ["/pricing", "/case-studies", "/integrations/salesforce"],
    "session_duration_seconds": 342,
    "visit_count": 3
  }' \
  --wait

# Batch deanonymize visitor log
cat visitor_ips.json | jq -c '.[]' | while read visitor; do
  clay fire website-visitor --data "$visitor" --wait \
    | jq 'select(.data.identified == true)'
done
```

## output

```json
{
  "success": true,
  "table": "website-visitor",
  "data": {
    "ip_address": "104.18.24.47",
    "identified": true,
    "confidence": "high",
    "company": "GrowthCo",
    "domain": "growthco.com",
    "company_size": 280,
    "industry": "SaaS",
    "funding_stage": "Series B",
    "icp_tier": "A",
    "pages_visited": ["/pricing", "/case-studies"],
    "visited_pricing": true,
    "intent_score": 88,
    "session_info": {
      "visit_count": 3,
      "total_time_seconds": 342,
      "first_visit": "2026-03-01",
      "last_visit": "2026-03-05"
    },
    "buyer_contact": {
      "name": "Jane Smith",
      "title": "VP Revenue Operations",
      "linkedin_url": "https://linkedin.com/in/jsmith",
      "email": "jane@growthco.com",
      "email_verified": true,
      "identification_method": "linkedin_company_match"
    },
    "recommended_action": "reach_out_today",
    "outreach_angle": "GrowthCo has visited your pricing page 3 times in 5 days. Jane Smith (VP RevOps) is likely the buyer — reach out before they go to a competitor."
  }
}
```

## clay table setup

1. Trigger: **Webhook** (send visitor IP + page data from your analytics/reverse IP tool)
2. Steps:
   - IP-to-Company Resolution (Clearbit Reveal, RB2B, or 6sense)
   - Company Enrichment (size, industry, funding)
   - ICP Score
   - LinkedIn Company Scrape → find relevant buyer persona at that company
   - Email Finder for buyer contact
   - Intent Score calculation (pages visited + session depth + visit frequency)
   - AI outreach angle
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Process only identified visitors with ICP fit
clay fire website-visitor \
  --data '{"ip_address":"104.18.24.47","pages_visited":["/pricing"]}' \
  --wait | jq 'select(.data.identified == true and .data.icp_tier == "A")'

# Get buyer contact for identified pricing page visitor
clay fire website-visitor \
  --data '{"ip_address":"104.18.24.47","pages_visited":["/pricing"]}' \
  --wait | jq 'select(.data.visited_pricing == true) | .data.buyer_contact'

# Daily visitor enrichment sweep
cat todays_visitors.json | jq -c '.[]' | while read visitor; do
  clay fire website-visitor --data "$visitor" --wait \
    | jq 'select(.data.identified == true and .data.icp_tier != "D") | {
        company: .data.company,
        contact: .data.buyer_contact.name,
        email: .data.buyer_contact.email,
        intent: .data.intent_score,
        action: .data.recommended_action
      }'
done

# Alert on repeat pricing page visitors
clay fire website-visitor \
  --data '{"ip_address":"104.18.24.47","pages_visited":["/pricing"],"visit_count":4}' \
  --wait | jq 'select(.data.visited_pricing == true and .data.session_info.visit_count >= 3) | {
    company: .data.company,
    contact: .data.buyer_contact.name,
    urgency: "high"
  }'
```

## row limit

```bash
clay usage show website-visitor
clay tables reset website-visitor --webhook-url https://app.clay.com/webhook/NEW_ID
```
