# clay-crm-sync — CRM Data Enrichment and Sync

Enrich and update CRM records (Salesforce, HubSpot, Pipedrive) by running contacts and companies through Clay enrichment, then writing back enriched fields. Keeps your CRM clean and complete without manual data entry.

## install

```bash
npm install -g clay-gtm-cli
brew install cloudflared
clay tables add \
  --name crm-enrich \
  --webhook-url https://app.clay.com/webhook/YOUR_WEBHOOK_ID \
  --description "Enrich a CRM record and return updated fields for writeback"
clay listen start
```

## commands

```bash
# Enrich a contact record (pass whatever fields you have)
clay fire crm-enrich \
  --data '{
    "crm_id": "003Dn00000XzABCIAM",
    "crm_type": "contact",
    "email": "john@acme.com",
    "first_name": "John",
    "last_name": "Doe",
    "company": "Acme Corp"
  }' \
  --wait

# Enrich an account record by domain
clay fire crm-enrich \
  --data '{
    "crm_id": "001Dn00000XzXYZIAM",
    "crm_type": "account",
    "domain": "acme.com"
  }' \
  --wait

# Enrich with LinkedIn URL (most complete enrichment)
clay fire crm-enrich \
  --data '{
    "crm_id": "003Dn00000XzABCIAM",
    "crm_type": "contact",
    "linkedin_url": "https://linkedin.com/in/jdoe",
    "email": "john@acme.com"
  }' \
  --wait

# Enrich a stale record (missing title/department)
clay fire crm-enrich \
  --data '{
    "crm_id": "003Dn00000XzABCIAM",
    "crm_type": "contact",
    "email": "john@acme.com",
    "enrich_fields": ["title", "phone", "linkedin_url", "department"]
  }' \
  --wait
```

## output

```json
{
  "success": true,
  "table": "crm-enrich",
  "data": {
    "crm_id": "003Dn00000XzABCIAM",
    "crm_type": "contact",
    "enriched_fields": {
      "title": "VP of Revenue Operations",
      "department": "Revenue Operations",
      "phone": "+1-415-555-0100",
      "linkedin_url": "https://linkedin.com/in/jdoe",
      "company_domain": "acme.com",
      "company_employee_count": 450,
      "company_funding_stage": "Series C",
      "company_industry": "SaaS",
      "email_verified": true,
      "email_confidence": 0.96,
      "icp_score": 88,
      "icp_tier": "A",
      "last_enriched_at": "2026-03-05T17:00:00Z"
    },
    "changed_fields": ["title", "phone", "linkedin_url", "company_employee_count"],
    "unchanged_fields": ["email", "first_name", "last_name"]
  }
}
```

## clay table setup

1. Trigger: **Webhook** (pass CRM ID + whatever fields you have)
2. Steps:
   - Person Enrichment (LinkedIn/Clearbit)
   - Company Enrichment (domain lookup)
   - Email Validation
   - ICP Scoring
3. Final step: **HTTP API** → POST to `{{_callback_url}}` with `crm_id` + enriched fields for CRM writeback

## common patterns

```bash
# Enrich a contact and write back to Salesforce
RESULT=$(clay fire crm-enrich \
  --data '{"crm_id":"003XYZ","email":"john@acme.com","linkedin_url":"https://linkedin.com/in/jdoe"}' \
  --wait)

CRM_ID=$(echo $RESULT | jq -r '.data.crm_id')
TITLE=$(echo $RESULT | jq -r '.data.enriched_fields.title')
PHONE=$(echo $RESULT | jq -r '.data.enriched_fields.phone')
ICP=$(echo $RESULT | jq -r '.data.enriched_fields.icp_tier')

echo "CRM ID $CRM_ID: Title=$TITLE, Phone=$PHONE, ICP=$ICP"
# Then call your CRM API to write back these fields

# Batch enrich contacts from a CRM export
cat crm_export.json | jq -c '.[]' | while read contact; do
  clay fire crm-enrich --data "$contact" --wait \
    | jq '{crm_id: .data.crm_id, fields: .data.enriched_fields}'
done

# Find and enrich contacts missing LinkedIn URLs
cat crm_export.json | jq -c '.[] | select(.linkedin_url == null or .linkedin_url == "")' \
  | while read contact; do
    clay fire crm-enrich --data "$contact" --wait \
      | jq 'select(.data.enriched_fields.linkedin_url != null)'
  done

# Nightly enrichment job (add to crontab)
# 0 2 * * * run this script on contacts updated in last 24h
```

## row limit

```bash
clay usage show crm-enrich
clay tables reset crm-enrich --webhook-url https://app.clay.com/webhook/NEW_ID
```
