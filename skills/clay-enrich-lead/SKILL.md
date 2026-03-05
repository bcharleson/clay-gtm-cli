# clay-enrich-lead — Enrich a Lead from LinkedIn

Enrich a person's LinkedIn profile to get full name, job title, company, location, bio, and contact data. Use this whenever you have a LinkedIn URL and need structured professional data.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared       # macOS — needed for --wait callback
clay tables add \
  --name enrich-lead \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Enrich LinkedIn profile — name, title, company, email"
clay listen start               # start callback listener in a separate terminal
```

## commands

```bash
# Enrich by LinkedIn URL — blocks until Clay responds
clay fire enrich-lead \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait

# Enrich with full name + company as fallback
clay fire enrich-lead \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe", "first_name": "John", "last_name": "Doe", "company": "Acme Corp"}' \
  --wait

# Fire-and-forget (no callback needed)
clay fire enrich-lead \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' 

# Check how many rows are left on this table
clay usage show enrich-lead
```

## output

```json
{
  "success": true,
  "table": "enrich-lead",
  "data": {
    "full_name": "John Doe",
    "first_name": "John",
    "last_name": "Doe",
    "title": "VP of Engineering",
    "company": "Acme Corp",
    "company_domain": "acme.com",
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "location": "San Francisco, CA",
    "email": "john@acme.com",
    "email_verified": true,
    "bio": "VP Engineering at Acme Corp. Previously at...",
    "followers": 2400
  }
}
```

## clay table setup

In your Clay table:
1. Trigger: **Webhook**
2. Steps: Enrich Person (LinkedIn), Find Work Email (optional)
3. Final step: **HTTP API** → POST to `{{_callback_url}}` with enriched columns mapped to the body

## common patterns

```bash
# Enrich a lead before adding to a sequence
RESULT=$(clay fire enrich-lead --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' --wait)
echo $RESULT | jq '.data.email'
echo $RESULT | jq '.data.title'

# Enrich and check if senior enough to contact (title check via jq)
clay fire enrich-lead \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait | jq 'select(.data.title | test("VP|Director|Head|Chief"; "i"))'

# Batch: enrich multiple leads from a file
cat leads.json | jq -c '.[]' | while read lead; do
  clay fire enrich-lead --data "$lead" --wait --pretty
done

# Check row limit before a large batch
clay usage show enrich-lead --pretty
```

## row limit

Clay tables have a 50,000 row limit. When you get close:

```bash
# Check usage
clay usage show enrich-lead
# → percentUsed: 92

# After duplicating table in Clay + getting new webhook URL:
clay tables reset enrich-lead --webhook-url https://app.clay.com/webhook/NEW_ID
```
