import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { allCommands } from '../commands/index.js';
import { formatError } from '../core/errors.js';

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'clay',
    version: '0.1.0',
  });

  for (const cmdDef of allCommands) {
    const shape = cmdDef.inputSchema.shape;

    server.registerTool(
      cmdDef.name,
      {
        description: cmdDef.description,
        inputSchema: shape,
      },
      async (args: { [key: string]: unknown }) => {
        try {
          const parsed = cmdDef.inputSchema.safeParse(args);
          if (!parsed.success) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }),
                },
              ],
              isError: true,
            };
          }

          const result = await cmdDef.handler(parsed.data);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(formatError(error)) }],
            isError: true,
          };
        }
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(`Clay MCP server started. Tools registered: ${allCommands.length}\n`);
}
