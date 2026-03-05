# Clay CLI — Developer Guide

## Overview

`clay-gtm-cli` is an agent-native CLI + MCP server for Clay.com webhook orchestration. It follows the same `CommandDefinition` architecture as `instantly-cli` and `ms365-cli`.

## Tech Stack

- **TypeScript** (ESM, Node 18+)
- **Commander.js** — CLI framework
- **Zod** — schema validation (shared between CLI and MCP)
- **@modelcontextprotocol/sdk** — MCP server
- **tsup** — bundler
- **node:http** — callback server (stdlib)
- **cloudflared** — tunnel to expose localhost (external binary)

## Directory Layout

```
src/
├── index.ts              # CLI entry point (Commander program)
├── mcp.ts                # MCP entry point (standalone)
├── core/
│   ├── types.ts          # CommandDefinition, ClayTable, CallbackResult, etc.
│   ├── client.ts         # HTTP client with retry + rate limit awareness
│   ├── config.ts         # ~/.clay/ file I/O (tables, usage, listener, config)
│   ├── output.ts         # JSON output formatting (--pretty, --fields, --quiet)
│   ├── errors.ts         # Typed errors (WebhookError, TimeoutError, LimitError)
│   ├── usage.ts          # Row count tracking + threshold warnings
│   ├── listener.ts       # Local HTTP callback server (http.createServer)
│   └── tunnel.ts         # cloudflared tunnel spawn + URL capture
├── commands/
│   ├── index.ts          # allCommands registry + registerAllCommands()
│   ├── config/           # config set, config get
│   ├── tables/           # add, list, get, update, remove, reset
│   ├── fire/             # fire (the core command)
│   ├── listen/           # start, status
│   ├── usage/            # show, sync
│   └── mcp/              # mcp subcommand registration
└── mcp/
    └── server.ts         # MCP server (auto-registers all commands as tools)
```

## CommandDefinition Pattern

Every command is a single `CommandDefinition` object that drives both the CLI subcommand and the MCP tool:

```typescript
interface CommandDefinition<TInput> {
  name: string;           // MCP tool name: "tables_add"
  group: string;          // CLI group: "tables"
  subcommand: string;     // CLI subcommand: "add"
  description: string;    // Shared help text
  inputSchema: TInput;    // Zod schema (validates CLI + MCP input)
  cliMappings: CliMapping; // Maps schema fields to CLI args/options
  handler: (input) => Promise<unknown>;
}
```

## Adding a New Command

1. Create `src/commands/<group>/<subcommand>.ts`
2. Export a `CommandDefinition` with Zod schema and handler
3. Import and add it to `allCommands` in `src/commands/index.ts`
4. Done — it appears in both CLI and MCP automatically

## Local Storage

All state lives in `~/.clay/`:

| File            | Purpose                       |
|-----------------|-------------------------------|
| tables.json     | Registered webhook tables     |
| usage.json      | Row count tracking per table  |
| listener.json   | Running listener PID/port/URL |
| config.json     | Global config (callback URL)  |

## Development

```bash
npm install
npm run dev -- tables list          # Run in dev mode (tsx)
npm run build                       # Build with tsup
npm run typecheck                   # Type-check (tsc --noEmit)
```

## Build Outputs

tsup produces two entry points:
- `dist/index.js` — CLI binary (has shebang)
- `dist/mcp.js` — MCP server entry point

## Conventions

- All output is JSON to stdout
- Warnings and info go to stderr
- Errors are typed (`ClayError` subclasses) with machine-readable `code` fields
- No interactive prompts in command handlers (agent-friendly)
- Zod schemas are the single source of truth for input validation
