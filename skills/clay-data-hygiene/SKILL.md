# clay-data-hygiene — CRM Data Normalization and Cleaning

Normalize, deduplicate, and validate CRM data at scale. Fix malformed company names, standardize titles and departments, validate and re-verify emails, normalize phone numbers, and flag duplicate records. Run this on CRM exports to maintain clean data without manual effort.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared
clay tables add \
  --name data-hygiene \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "CRM data normalization — clean names, validate emails, normalize phones, flag dupes"
clay listen start
```

## commands

```bash
# Clean a single contact record
clay fire data-hygiene \
  --data '{
    "crm_id": "003XYZ",
    "crm_type": "contact",
    "first_name": "john",
    "last_name": "DOE",
    "email": "john.doe@acme.com",
    "phone": "415-555-0100",
    "title": "vp, revenue operations",
    "company": "acme corp"
  }' \
  --wait

# Validate and re-verify email only
clay fire data-hygiene \
  --data '{
    "crm_id": "003XYZ",
    "email": "john@acmecorp.com",
    "mode": "email_only"
  }' \
  --wait

# Full deduplication check
clay fire data-hygiene \
  --data '{
    "crm_id": "003XYZ",
    "email": "john@acme.com",
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "mode": "deduplicate"
  }' \
  --wait

# Batch clean a CRM export
cat crm_contacts.json | jq -c '.[]' | while read contact; do
  clay fire data-hygiene --data "$contact" --wait
done
```

## output

```json
{
  "success": true,
  "table": "data-hygiene",
  "data": {
    "crm_id": "003XYZ",
    "original": {
      "first_name": "john",
      "last_name": "DOE",
      "title": "vp, revenue operations",
      "company": "acme corp",
      "email": "john.doe@acme.com",
      "phone": "415-555-0100"
    },
    "cleaned": {
      "first_name": "John",
      "last_name": "Doe",
      "title": "VP of Revenue Operations",
      "title_normalized": "VP Revenue Operations",
      "department": "Revenue Operations",
      "seniority": "VP",
      "company": "Acme Corp",
      "company_domain": "acme.com",
      "email": "john.doe@acme.com",
      "email_valid": true,
      "email_deliverable": true,
      "email_confidence": 0.95,
      "phone": "+14155550100",
      "phone_formatted": "(415) 555-0100"
    },
    "issues_found": ["title_not_normalized", "phone_missing_country_code", "company_name_inconsistent"],
    "issues_fixed": ["title_normalized", "phone_normalized"],
    "duplicate_check": {
      "is_duplicate": false,
      "potential_duplicates": []
    },
    "data_quality_score": 94
  }
}
```

## clay table setup

1. Trigger: **Webhook**
2. Steps:
   - Name normalization (proper case formula)
   - Title standardization (AI column: map raw titles to standardized set)
   - Company name normalization (remove "Inc", "LLC", etc., proper case)
   - Email validation (Hunter/NeverBounce/ZeroBounce)
   - Phone normalization (E.164 format formula)
   - Duplicate detection (lookup against existing CRM records via HTTP)
   - Data quality score calculation
3. Final step: **HTTP API** → POST to `{{_callback_url}}`

## common patterns

```bash
# Only return records with issues to fix
clay fire data-hygiene \
  --data '{"crm_id":"003XYZ","email":"john@acme.com","title":"vp sales"}' \
  --wait | jq 'select(.data.issues_found | length > 0)'

# Get just the cleaned fields for CRM writeback
clay fire data-hygiene \
  --data '{"crm_id":"003XYZ","email":"john@acme.com","first_name":"john","last_name":"DOE"}' \
  --wait | jq '{crm_id: .data.crm_id, cleaned: .data.cleaned}'

# Find duplicate records
clay fire data-hygiene \
  --data '{"crm_id":"003XYZ","email":"john@acme.com","linkedin_url":"https://linkedin.com/in/jdoe","mode":"deduplicate"}' \
  --wait | jq 'select(.data.duplicate_check.is_duplicate == true)'

# Quality sweep — find low-quality records
cat crm_export.json | jq -c '.[]' | while read contact; do
  clay fire data-hygiene --data "$contact" --wait \
    | jq 'select(.data.data_quality_score < 70) | {crm_id: .data.crm_id, score: .data.data_quality_score, issues: .data.issues_found}'
done

# Validate all emails in CRM before a big campaign send
cat contacts.json | jq -c '.[] | {crm_id: .Id, email: .Email, mode: "email_only"}' \
  | while read contact; do
    clay fire data-hygiene --data "$contact" --wait \
      | jq 'select(.data.cleaned.email_deliverable == false) | {crm_id: .data.crm_id, email: .data.original.email}'
  done
```

## row limit

```bash
clay usage show data-hygiene
clay tables reset data-hygiene --webhook-url https://app.clay.com/webhook/NEW_ID
```
