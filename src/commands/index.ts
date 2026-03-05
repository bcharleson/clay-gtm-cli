import { Command } from 'commander';
import type { CommandDefinition, GlobalOptions } from '../core/types.js';
import { output } from '../core/output.js';
import { formatError } from '../core/errors.js';

import { tablesAddCommand } from './tables/add.js';
import { tablesListCommand } from './tables/list.js';
import { tablesGetCommand } from './tables/get.js';
import { tablesUpdateCommand } from './tables/update.js';
import { tablesRemoveCommand } from './tables/remove.js';
import { tablesResetCommand } from './tables/reset.js';

import { configSetCommand } from './config/set.js';
import { configGetCommand } from './config/get.js';

import { usageShowCommand } from './usage/show.js';
import { usageSyncCommand } from './usage/sync.js';

import { fireCommand } from './fire/index.js';

import { listenStartCommand } from './listen/start.js';
import { listenStatusCommand } from './listen/status.js';

export const allCommands: CommandDefinition[] = [
  tablesAddCommand,
  tablesListCommand,
  tablesGetCommand,
  tablesUpdateCommand,
  tablesRemoveCommand,
  tablesResetCommand,
  configSetCommand,
  configGetCommand,
  usageShowCommand,
  usageSyncCommand,
  fireCommand,
  listenStartCommand,
  listenStatusCommand,
];

function registerCommand(parent: Command, cmdDef: CommandDefinition): void {
  const cmd = parent.command(cmdDef.subcommand).description(cmdDef.description);

  if (cmdDef.cliMappings.args) {
    for (const arg of cmdDef.cliMappings.args) {
      const bracket = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
      cmd.argument(bracket, arg.description ?? '');
    }
  }

  if (cmdDef.cliMappings.options) {
    for (const opt of cmdDef.cliMappings.options) {
      cmd.option(opt.flags, opt.description ?? '');
    }
  }

  cmd.action(async (...actionArgs: unknown[]) => {
    const globalOpts: GlobalOptions = cmd.optsWithGlobals();
    const input: Record<string, unknown> = {};

    if (cmdDef.cliMappings.args) {
      cmdDef.cliMappings.args.forEach((arg, i) => {
        if (actionArgs[i] !== undefined) {
          input[arg.field] = actionArgs[i];
        }
      });
    }

    const cmdOpts = cmd.opts();
    if (cmdDef.cliMappings.options) {
      for (const opt of cmdDef.cliMappings.options) {
        const camelKey = opt.field;
        if (cmdOpts[camelKey] !== undefined) {
          input[camelKey] = cmdOpts[camelKey];
        }
      }
    }

    const parsed = cmdDef.inputSchema.safeParse(input);
    if (!parsed.success) {
      output({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, globalOpts);
      process.exit(1);
    }

    try {
      const result = await cmdDef.handler(parsed.data);
      output(result, globalOpts);
    } catch (error) {
      output(formatError(error), globalOpts);
      process.exit(1);
    }
  });
}

export function registerAllCommands(program: Command): void {
  const groups = new Map<string, CommandDefinition[]>();

  for (const cmd of allCommands) {
    if (!groups.has(cmd.group)) groups.set(cmd.group, []);
    groups.get(cmd.group)!.push(cmd);
  }

  // Top-level commands that register directly on the program (not as subgroups)
  const TOP_LEVEL = new Set(['fire']);

  for (const [groupName, commands] of groups) {
    if (TOP_LEVEL.has(groupName)) {
      for (const cmdDef of commands) {
        registerCommand(program, { ...cmdDef, subcommand: groupName });
      }
      continue;
    }

    const groupCmd = program.command(groupName).description(`Manage ${groupName}`);
    for (const cmdDef of commands) {
      registerCommand(groupCmd, cmdDef);
    }
  }
}
