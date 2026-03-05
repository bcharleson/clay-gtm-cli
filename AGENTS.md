# Clay CLI — Agent Skill

You have access to `clay`, a CLI tool for firing Clay.com webhook tables and receiving async callback responses. This enables you to leverage Clay's enrichment, email finding, validation, and any other workflow the user has configured — all from your terminal.

## How It Works

1. The user registers Clay webhook tables with `clay tables add`
2. You fire webhooks with `clay fire <table> --data '{...}'`
3. For async responses, a callback listener tunnels via cloudflared — Clay POSTs enriched data back
4. You receive structured JSON with the enriched result

## Prerequisites

- `clay-cli` installed globally: `npm install -g clay-gtm-cli`
- `cloudflared` installed (for callback listener): `brew install cloudflared` (macOS) or `apt install cloudflared` (Linux)
- At least one Clay webhook table registered

## Quick Start

```bash
# 1. Register a webhook table
clay tables add --name enrich-lead \
  --webhook-url https://app.clay.com/webhook/abc123 \
  --description "Enrich LinkedIn profile + find email"

# 2. Start the callback listener (in a separate terminal or background)
clay listen start

# 3. Fire a webhook and wait for the callback
clay fire enrich-lead \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait --timeout 120
```

## Commands Reference

### Tables — Register and manage Clay webhook endpoints

```bash
# Register a new table
clay tables add --name <name> --webhook-url <url> [--auth-key <key>] [--description <text>] [--row-limit <n>]

# List all registered tables with usage
clay tables list

# Get details for one table
clay tables get <name>

# Update a table's URL, auth key, or description
clay tables update <name> [--webhook-url <url>] [--auth-key <key>] [--description <text>]

# Remove a table from the registry
clay tables remove <name>

# Reset row counter + update webhook URL (after duplicating in Clay)
clay tables reset <name> --webhook-url <new-url>
```

### Fire — Send data to a Clay webhook

```bash
# Fire and forget (no callback)
clay fire <table-name> --data '{"key": "value"}'

# Fire and wait for async callback response
clay fire <table-name> --data '{"key": "value"}' --wait

# Fire with custom timeout (default: 120s)
clay fire <table-name> --data '{"key": "value"}' --wait --timeout 300
```

When using `--wait`, the CLI automatically injects `_callback_url` and `_callback_id` into the webhook payload. The Clay table must have an HTTP API step at the end that POSTs to `_callback_url` with the enriched data.

### Listen — Callback listener (local server + cloudflared tunnel)

```bash
# Start the listener (foreground, Ctrl+C to stop)
clay listen start

# Start on a specific port
clay listen start --port 9876

# Check listener status
clay listen status
```

The listener prints a public HTTPS URL (via trycloudflare.com). This URL is automatically used when you run `clay fire --wait`.

### Usage — Track row counts toward the 50k limit

```bash
# Show usage for all tables
clay usage show

# Show usage for a specific table
clay usage show <table-name>

# Sync with remote KV (v2 — currently local-only)
clay usage sync
```

### Config

```bash
# View current configuration
clay config get

# Set a permanent callback URL (skips auto-tunnel)
clay config set --callback-url https://my-permanent-tunnel.example.com
```

### MCP Server

```bash
# Start as MCP server (for Claude Desktop, Cursor, etc.)
clay mcp
```

## Webhook Payload Format

When you call `clay fire enrich-lead --data '{"linkedin_url": "..."}' --wait`, the CLI sends this to the Clay webhook:

```json
{
  "linkedin_url": "https://linkedin.com/in/jdoe",
  "_callback_url": "https://random-word.trycloudflare.com/callback/550e8400-e29b-41d4-a716-446655440000",
  "_callback_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

The `_callback_url` and `_callback_id` fields are injected automatically. Without `--wait`, they are omitted.

## Callback Payload Schema

The last step in the Clay table must be an **HTTP API** action that POSTs to the `_callback_url` column value. The POST body is whatever enriched data you want returned to the agent:

```json
{
  "full_name": "John Doe",
  "company": "Acme Corp",
  "title": "VP Engineering",
  "email": "john@acme.com",
  "email_verified": true,
  "linkedin_url": "https://linkedin.com/in/jdoe"
}
```

The agent receives this as:

```json
{
  "success": true,
  "table": "enrich-lead",
  "callbackId": "550e8400-...",
  "data": {
    "full_name": "John Doe",
    "company": "Acme Corp",
    "title": "VP Engineering",
    "email": "john@acme.com",
    "email_verified": true,
    "linkedin_url": "https://linkedin.com/in/jdoe"
  }
}
```

## Row Limit Management

Every Clay table has a 50,000 row limit. The CLI tracks how many times each webhook has been fired.

- At **90% usage** (45,000 rows): prints a warning to stderr
- At **100% usage** (50,000 rows): throws a `LimitError` and refuses to fire

**When you hit the limit:**

1. Duplicate the table in Clay (this creates a new table with a fresh webhook URL and 0 rows)
2. Run `clay tables reset <name> --webhook-url <new-webhook-url>` to reset the counter and swap in the new URL
3. Continue firing as before

```bash
# Check how close you are
clay usage show enrich-lead

# After duplicating in Clay
clay tables reset enrich-lead --webhook-url https://app.clay.com/webhook/new456
```

## Common Use Cases

### Enrich a LinkedIn profile

```bash
clay fire enrich-lead --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' --wait
```

### Find and validate an email address

```bash
clay fire find-email --data '{"first_name": "John", "last_name": "Doe", "company_domain": "acme.com"}' --wait
```

### Company lookup

```bash
clay fire company-lookup --data '{"domain": "acme.com"}' --wait
```

### Fire-and-forget (no callback needed)

```bash
clay fire log-event --data '{"event": "demo_booked", "lead_id": "abc123"}'
```

## Setting Up a Clay Table for Callback

The human user must configure the Clay table:

1. **Create a webhook table** in Clay.com
2. **Set the trigger** to "Webhook"
3. **Copy the webhook URL** — give it to the agent via `clay tables add`
4. **Add enrichment steps** (e.g., Enrich Person, Find Email, etc.)
5. **Add a final HTTP API step:**
   - Method: POST
   - URL: Use the `_callback_url` column (the value injected by the CLI)
   - Body: Map the enriched columns you want returned to the agent
6. The callback listener receives the POST and returns it to the waiting `clay fire --wait` call

## GTM Use Case Skills (21 total)

Each skill is a detailed `SKILL.md` in the `skills/` folder with full command examples, expected output, Clay table setup steps, and `jq` patterns.

### Prospecting
| Skill | When to use |
|-------|-------------|
| `clay-prospect-list` | Build a list from ICP filters (industry, size, title, tech) |
| `clay-lookalike` | Find lookalikes from your best customer domains |
| `clay-champion-track` | Monitor champions who left customers — highest-converting signal |

### Enrichment
| Skill | When to use |
|-------|-------------|
| `clay-enrich-lead` | You have a LinkedIn URL and need full profile data |
| `clay-find-email` | You need a verified work email before outreach |
| `clay-company-research` | You need to qualify or research a target account |
| `clay-outbound-prep` | Full pipeline — enrich + email + score + AI first-line in one shot |

### Signals & Triggers
| Skill | When to use |
|-------|-------------|
| `clay-icp-score` | Score a lead for ICP fit (A/B/C/D tier) |
| `clay-job-change` | Detect job changes and hiring surges |
| `clay-intent-data` | Check G2/Bombora intent — who is evaluating your category |
| `clay-news-trigger` | Funding, hires, product launches — find the right outreach moment |
| `clay-website-visitor` | Deanonymize website visitors — IP to company + buyer contact |

### ABM
| Skill | When to use |
|-------|-------------|
| `clay-account-research` | Buying committee, engagement strategy, multi-thread account plan |

### Personalization & Sequencing
| Skill | When to use |
|-------|-------------|
| `clay-personalize` | Generate AI first lines, subjects, LinkedIn notes from enriched data |
| `clay-sequence-router` | Decide which sequence, rep, and send time for a lead |
| `clay-suppression-check` | Check opt-out/DNC lists before any outreach |
| `clay-reply-classify` | Classify inbound replies + get next action |

### CRM & Data Ops
| Skill | When to use |
|-------|-------------|
| `clay-crm-sync` | Enrich and write back to Salesforce/HubSpot records |
| `clay-data-hygiene` | Normalize, validate, and deduplicate CRM data |

### Post-Sale
| Skill | When to use |
|-------|-------------|
| `clay-expansion-signals` | Detect upsell readiness — growth, usage limits, funding |
| `clay-renewal-research` | Pre-renewal intelligence — health, risk, champion stability |

Install all skills: `npx skills add https://github.com/bcharleson/clay-cli`

---

## MCP Configuration

Add to Claude Desktop, Cursor, or VS Code MCP settings:

```json
{
  "mcpServers": {
    "clay": {
      "command": "npx",
      "args": ["clay-gtm-cli", "mcp"]
    }
  }
}
```

This registers all clay-gtm-cli commands as MCP tools: `tables_add`, `tables_list`, `tables_get`, `fire`, `listen_start`, `usage_show`, etc.

## Output

All commands output JSON. Use `--pretty` for formatted output, `--fields` to select specific fields, `--quiet` to suppress output.

```bash
clay tables list --pretty
clay tables list --fields "name,rowsUsed,remaining"
clay fire enrich-lead --data '...' --wait --quiet
```
