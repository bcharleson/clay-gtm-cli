# clay-cli

**Clay.com in your terminal.** Fire webhooks, receive async enrichment callbacks, and track row limits — from a single command line.

Agent-native CLI + MCP server. Built for humans, scripts, and AI agents.

```bash
npm install -g clay-cli
```

---

## What This CLI Enables

Clay.com is a powerful data enrichment and workflow platform. Tables are triggered via webhooks, process data through enrichment steps, and can return results via HTTP callbacks.

**clay-cli** wraps this into a simple, scriptable interface:

- **Fire webhooks** — send any JSON payload to a Clay table
- **Async callbacks** — wait for Clay to finish processing and receive enriched data back
- **Row limit tracking** — know when tables approach the 50k limit, and reset with new URLs
- **MCP server** — every command is an AI tool for Claude, Cursor, or any MCP client

---

## How It Works

```
Agent/Script                    clay-cli                     Clay.com
     |                             |                            |
     |-- clay fire --wait -------->|                            |
     |                             |-- POST webhook URL ------->|
     |                             |   (payload + callback_url) |
     |                             |                            |-- enrich/validate/etc.
     |                             |                            |
     |                             |<---- POST callback_url ----|
     |                             |      (enriched data)       |
     |<--- return enriched JSON ---|                            |
```

1. You register Clay webhook tables with `clay tables add`
2. `clay listen start` spins up a local HTTP server + cloudflared tunnel
3. `clay fire <table> --data '{...}' --wait` fires the webhook and blocks until Clay posts back
4. The enriched data is returned as structured JSON

---

## Setup

### Step 1 — Install

```bash
npm install -g clay-cli
```

### Step 2 — Install cloudflared (for async callbacks)

```bash
# macOS
brew install cloudflared

# Linux
sudo apt install cloudflared

# Other
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

### Step 3 — Register a webhook table

Create a webhook table in Clay.com, copy the webhook URL, then:

```bash
clay tables add \
  --name enrich-lead \
  --webhook-url https://app.clay.com/webhook/abc123 \
  --description "Enrich LinkedIn profile + find email"
```

### Step 4 — Start the listener

```bash
clay listen start
```

This prints a public HTTPS callback URL (via trycloudflare.com). Configure the last step in your Clay table to POST to `{{_callback_url}}` with the enriched data.

### Step 5 — Fire and wait

```bash
clay fire enrich-lead \
  --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' \
  --wait
```

The CLI blocks until Clay finishes processing and posts the result back.

---

## Quick Start

```bash
# Register a table
clay tables add --name enrich-lead --webhook-url https://app.clay.com/webhook/abc123

# Start listener (in another terminal)
clay listen start

# Fire and wait for enriched data
clay fire enrich-lead --data '{"linkedin_url": "https://linkedin.com/in/jdoe"}' --wait

# Check usage
clay usage show

# Fire without waiting (fire-and-forget)
clay fire log-event --data '{"event": "demo_booked"}'
```

---

## Commands

### Tables

```bash
clay tables add --name <n> --webhook-url <url> [--auth-key <key>] [--description <text>]
clay tables list
clay tables get <name>
clay tables update <name> [--webhook-url <url>] [--auth-key <key>]
clay tables remove <name>
clay tables reset <name> --webhook-url <new-url>
```

### Fire

```bash
clay fire <table> --data '<json>' [--wait] [--timeout <seconds>]
```

### Listen

```bash
clay listen start [--port <number>]
clay listen status
```

### Usage

```bash
clay usage show [table-name]
clay usage sync
```

### Config

```bash
clay config get
clay config set --callback-url <url>
```

### MCP

```bash
clay mcp
```

---

## Output

All commands output JSON. Pipe to `jq`, save to files, or feed to other tools.

```bash
# Pretty print
clay tables list --pretty

# Select fields
clay tables list --fields "name,rowsUsed"

# Quiet mode (exit code only)
clay fire enrich-lead --data '...' --quiet
```

---

## Row Limit Management

Clay tables have a 50,000 row limit. The CLI tracks usage automatically.

```bash
# Check usage
clay usage show enrich-lead
# → {"table":"enrich-lead","rowsUsed":48500,"rowLimit":50000,"remaining":1500,"percentUsed":97}

# When at 50k: duplicate table in Clay, get new webhook URL, then:
clay tables reset enrich-lead --webhook-url https://app.clay.com/webhook/new456
```

---

## MCP Server

Every command is available as an MCP tool for AI assistants.

```bash
clay mcp
```

### Configure in Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "clay": {
      "command": "npx",
      "args": ["clay-cli", "mcp"]
    }
  }
}
```

Tools registered: `tables_add`, `tables_list`, `tables_get`, `tables_update`, `tables_remove`, `tables_reset`, `fire`, `listen_start`, `listen_status`, `usage_show`, `usage_sync`, `config_set`, `config_get`.

---

## Clay Table Setup (for the human)

To make a Clay table work with clay-cli callbacks:

1. **Create a webhook table** in Clay.com
2. **Set the trigger** to "Webhook"
3. **Copy the webhook URL** and register it: `clay tables add --name <name> --webhook-url <url>`
4. **Add enrichment steps** (Enrich Person, Find Email, Validate Email, etc.)
5. **Add a final HTTP API step:**
   - Method: `POST`
   - URL: Use the `_callback_url` column (auto-injected by clay-cli when using `--wait`)
   - Body: Map the enriched columns you want sent back

That's it. The agent fires `clay fire <name> --data '...' --wait` and receives the enriched response.

---

## Agent Skills

The repo ships 7 GTM-focused Agent Skills (`SKILL.md` files) — one per use case. Each teaches an AI agent exactly how to use the CLI for that workflow.

| Skill | Use Case |
|-------|----------|
| `skills/clay-enrich-lead/` | Enrich a LinkedIn profile — name, title, company, email |
| `skills/clay-find-email/` | Waterfall email finding + validation |
| `skills/clay-company-research/` | Company enrichment — size, funding, tech stack, news |
| `skills/clay-icp-score/` | ICP qualification scoring — fit tier + signal breakdown |
| `skills/clay-job-change/` | Job change + hiring signal detection |
| `skills/clay-outbound-prep/` | Full outbound prep — enrich + email + score + AI first-line |
| `skills/clay-account-research/` | ABM account research — buying committee + engagement strategy |

### Install all skills at once

```bash
npx skills add https://github.com/bcharleson/clay-cli
```

### Install a specific skill

```bash
npx skills add https://github.com/bcharleson/clay-cli/tree/main/skills/clay-outbound-prep
```

### OpenClaw agent setup

```bash
# Symlink all skills (stays in sync with repo)
ln -s $(pwd)/skills/clay-* ~/.openclaw/skills/
```

---

## Development

```bash
git clone https://github.com/bcharleson/clay-cli.git
cd clay-cli
npm install
npm run dev -- tables list
npm run build
npm run typecheck
```

---

## Architecture

Every command is a `CommandDefinition` — one source of truth powering both the CLI subcommand and the MCP tool:

```
src/
├── core/
│   ├── types.ts      # CommandDefinition interfaces
│   ├── client.ts     # HTTP client (retry, rate limit)
│   ├── config.ts     # ~/.clay/ config management
│   ├── errors.ts     # Typed error classes
│   ├── output.ts     # JSON output formatting
│   ├── usage.ts      # Row count tracking
│   ├── listener.ts   # Local HTTP callback server
│   └── tunnel.ts     # cloudflared tunnel management
├── commands/
│   ├── tables/       # 6 commands
│   ├── fire/         # 1 command (the core one)
│   ├── listen/       # 2 commands
│   ├── usage/        # 2 commands
│   └── config/       # 2 commands
└── mcp/
    └── server.ts     # MCP server (auto-registers all commands)
```

Adding a new command = one new file. It's automatically available in both CLI and MCP.

---

## License

MIT

## Inspired by

- [bcharleson/instantly-cli](https://github.com/bcharleson/instantly-cli) — architecture pattern
- [bcharleson/ms365-cli](https://github.com/bcharleson/ms365-cli) — CommandDefinition pattern
- [googleworkspace/cli](https://github.com/googleworkspace/cli) — agent-native CLI design
