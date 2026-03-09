# clay-enrich-lead — Enrich a Lead from LinkedIn

Enrich a LinkedIn profile to get full name, title, company, experience history, education, certifications, followers, and more.

> **Prerequisite:** Listener must be running. See clay-setup skill first.
> Check: `clay listen status --pretty`

## install

```bash
npm install -g clay-gtm-cli
# macOS: brew install cloudflared
# Linux: see clay-setup

clay tables add \
  --name enrich-lead \
  --webhook-url "https://api.clay.com/v3/sources/webhook/YOUR_WEBHOOK_ID" \
  --description "Enrich LinkedIn profile"

clay listen start --port 3456
```

## commands

```bash
# Enrich by LinkedIn URL
clay fire enrich-lead \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait --timeout 90 --pretty

# With fallback name fields
clay fire enrich-lead \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe", "first_name": "John", "last_name": "Doe", "company": "Acme"}' \
  --wait --timeout 90 --pretty

# Fire-and-forget (no callback)
clay fire enrich-lead --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}'

# Check row usage
clay usage show enrich-lead --pretty
```

## output (real schema from live response)

```json
{
  "success": true,
  "table": "enrich-lead",
  "callbackId": "uuid",
  "data": {
    "first_name": "Brandon",
    "last_name": "Charleson",
    "name": "Brandon Charleson",
    "headline": "AI-powered junkie / Clay & Automation Expert / Cold email strategist",
    "title": "Founder",
    "org": "Top of Funnel",
    "location_name": "Reno, Nevada, United States",
    "country": "United States",
    "summary": "...",
    "url": "https://www.linkedin.com/in/brandon-charleson",
    "slug": "brandon-charleson",
    "profile_id": 230373952,
    "num_followers": 25723,
    "connections": 14236,
    "jobs_count": 10,
    "last_refresh": "2026-03-09 17:00:35",
    "latest_experience": {
      "company": "Top of Funnel",
      "company_domain": "topoffunnel.com",
      "title": "Founder",
      "start_date": "2023-09-01",
      "end_date": null,
      "is_current": true,
      "locality": "United States",
      "org_id": 96659620,
      "yearly_revenue_range": "0-500K",
      "url": "https://www.linkedin.com/company/top-of-funnel",
      "summary": "..."
    },
    "current_experience": [],
    "experience": [],
    "education": [
      {
        "school_name": "Los Angeles Film School",
        "degree": "Bachelor's degree",
        "field_of_study": "Digital Filmmaking",
        "start_date": "2018-01-01",
        "end_date": "2021-03-01"
      }
    ],
    "certifications": [
      {
        "title": "Google Analytics",
        "company_name": "Google",
        "date": "2020-07-01"
      }
    ]
  }
}
```

Fields returned depend on what your Clay table maps in the HTTP API callback step.

## clay table setup

1. Trigger: **Webhook**
2. Steps: Enrich Person (LinkedIn), Find Work Email (optional)
3. Final step: **HTTP API** → POST to `{{_callback_url}}` with enriched columns in the body

## common patterns

```bash
# Extract just title + company
clay fire enrich-lead \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait --timeout 90 | jq '{title: .data.title, org: .data.org, followers: .data.num_followers}'

# Filter by seniority
clay fire enrich-lead \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait | jq 'select(.data.title | test("VP|Director|Head|Chief|Founder|Owner"; "i")) | .data.title'

# Batch enrich from file
cat linkedin_urls.txt | while read url; do
  clay fire enrich-lead \
    --data "{\"linkedin_url\": \"$url\"}" \
    --wait --timeout 90 --pretty
  sleep 2
done
```

## timeout guidance

| Table complexity        | Timeout       |
| ----------------------- | ------------- |
| LinkedIn only           | --timeout 60  |
| LinkedIn + email finder | --timeout 120 |
| Full waterfall + AI     | --timeout 240 |

## row limit

```bash
clay usage show enrich-lead --pretty
clay tables reset enrich-lead --webhook-url "https://api.clay.com/v3/sources/webhook/NEW_ID"
```
