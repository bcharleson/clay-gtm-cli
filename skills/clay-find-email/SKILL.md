# clay-find-email — Waterfall Email Finding + Validation

Find and validate a professional's work email using Clay's waterfall enrichment (tries multiple providers in sequence — Hunter, Apollo, Clearbit, etc. — until a verified email is found). Use this before adding a lead to an outbound sequence.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared
clay tables add \
  --name find-email \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Waterfall email finder + validation"
clay listen start
```

## commands

```bash
# Find email by name + company domain (most common)
clay fire find-email \
  --data '{"first_name": "John", "last_name": "Doe", "company_domain": "acme.com"}' \
  --wait

# Find email by LinkedIn URL (Clay resolves name + company)
clay fire find-email \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait

# Find email by name + company name (Clay resolves domain)
clay fire find-email \
  --data '{"first_name": "Jane", "last_name": "Smith", "company": "Stripe"}' \
  --wait

# With timeout for slow providers
clay fire find-email \
  --data '{"first_name": "Alex", "last_name": "Chen", "company_domain": "notion.so"}' \
  --wait --timeout 180
```

## output

```json
{
  "success": true,
  "table": "find-email",
  "data": {
    "email": "john@acme.com",
    "email_verified": true,
    "email_confidence": 0.97,
    "email_source": "hunter",
    "first_name": "John",
    "last_name": "Doe",
    "company_domain": "acme.com"
  }
}
```

If no email is found:
```json
{
  "success": true,
  "table": "find-email",
  "data": {
    "email": null,
    "email_verified": false,
    "email_confidence": 0,
    "email_source": null
  }
}
```

## clay table setup

In your Clay table:
1. Trigger: **Webhook**
2. Steps: Waterfall Email Finder (enable Hunter, Apollo, Clearbit, RocketReach, etc.), then Email Validator
3. Final step: **HTTP API** → POST to `{{_callback_url}}` with `email`, `email_verified`, `email_confidence`, `email_source`

## common patterns

```bash
# Only use emails above 90% confidence
clay fire find-email \
  --data '{"first_name": "Jane", "last_name": "Smith", "company_domain": "stripe.com"}' \
  --wait | jq 'select(.data.email_confidence >= 0.9) | .data.email'

# Find email, then only proceed if verified
RESULT=$(clay fire find-email \
  --data '{"first_name": "John", "last_name": "Doe", "company_domain": "acme.com"}' \
  --wait)

EMAIL=$(echo $RESULT | jq -r '.data.email')
VERIFIED=$(echo $RESULT | jq -r '.data.email_verified')

if [ "$VERIFIED" = "true" ] && [ "$EMAIL" != "null" ]; then
  echo "Email ready for outreach: $EMAIL"
else
  echo "No verified email found"
fi

# Enrich + find email in one shot (if using combined table)
clay fire enrich-and-email \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait --pretty
```

## row limit

```bash
clay usage show find-email
clay tables reset find-email --webhook-url https://app.clay.com/webhook/NEW_ID
```
