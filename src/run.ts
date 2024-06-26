import { createClient } from "@supabase/supabase-js";
import { CommanderError } from "commander";
import { Octokit } from "@octokit/rest";
import { createAdapters } from "./adapters";
import { CommandParser } from "./handlers/command-parser";
import { Context } from "./types/context";
import { Database } from "./types/database";
import { Env } from "./types/env";
import { PluginInputs } from "./types/plugin-input";

export async function run(inputs: PluginInputs, env: Env) {
  const octokit = new Octokit({ auth: inputs.authToken });
  const logger: Context["logger"] = {
    debug(message: unknown, ...optionalParams: unknown[]) {
      console.debug(message, ...optionalParams);
    },
    info(message: unknown, ...optionalParams: unknown[]) {
      console.log(message, ...optionalParams);
    },
    warn(message: unknown, ...optionalParams: unknown[]) {
      console.warn(message, ...optionalParams);
    },
    error(message: unknown, ...optionalParams: unknown[]) {
      console.error(message, ...optionalParams);
    },
    async fatal(message: unknown, ...optionalParams: unknown[]) {
      console.error(message, ...optionalParams);
      try {
        await octokit.issues.createComment({
          body: `\`\`\`
Failed to run command-query-user.
${message}

${commandParser.helpInformation()}
\`\`\``,
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          issue_number: context.payload.issue.number,
        });
      } finally {
        console.error(message, ...optionalParams);
      }
    },
  };
  if (inputs.eventName !== "issue_comment.created") {
    logger.warn(`Unsupported event ${inputs.eventName}, skipping.`);
    return;
  }
  const args = inputs.eventPayload.comment.body.trim().split(/\s+/);
  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_KEY);
  const context = {
    eventName: inputs.eventName,
    payload: inputs.eventPayload,
    config: inputs.settings,
    octokit,
    logger,
    adapters: {} as unknown as ReturnType<typeof createAdapters>,
  } as Context;
  context.adapters = createAdapters(supabase, context);
  const commandParser = new CommandParser(context);
  try {
    await commandParser.parse(args);
  } catch (e) {
    if (e instanceof CommanderError) {
      if (e.code !== "commander.unknownCommand") {
        await context.logger.fatal(e);
      }
    } else {
      context.logger.error("error", e);
      throw e;
    }
  }
}
