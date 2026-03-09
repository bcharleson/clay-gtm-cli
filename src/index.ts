import { Command } from 'commander';
import { registerAllCommands } from './commands/index.js';
import { registerMcpCommand } from './commands/mcp/index.js';
import { CLI_VERSION } from './core/version.js';

const program = new Command();

program
  .name('clay')
  .description(
    'Clay.com in your terminal. Fire webhooks, receive async callbacks via cloudflared tunnels, and track row limits. Agent-native CLI + MCP server.',
  )
  .version(CLI_VERSION)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--quiet', 'Suppress output (exit code only)')
  .option('--fields <fields>', 'Comma-separated fields to include in output');

registerAllCommands(program);
registerMcpCommand(program);

program.parse();
