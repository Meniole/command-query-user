import { createClient } from "@supabase/supabase-js";
import { createPlugin } from "@ubiquity-os/ubiquity-os-kernel";
import { ExecutionContext } from "hono";
import manifest from "../manifest.json";
import { createAdapters } from "./adapters";
import { run } from "./run";
import { SupportedEvents } from "./types/context";
import { Database } from "./types/database";
import { Env, envSchema } from "./types/env";
import { PluginSettings, pluginSettingsSchema } from "./types/plugin-input";

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext) {
    const toTime = Date.now() + 60000;
    const fromTime = Date.now();
    const timeParam = encodeURIComponent(`{"type":"absolute","to":${toTime},"from":${fromTime}}`);

    console.log(
      `https://dash.cloudflare.com/${env.CLOUDFLARE_ACCOUNT_ID}/workers/services/view/${env.CLOUDFLARE_WORKER_NAME}/production/observability/logs?granularity=0&time=${timeParam}`
    );
    return createPlugin<PluginSettings, Env, SupportedEvents>(
      (context) => {
        const supabase = createClient<Database>(context.env.SUPABASE_URL, context.env.SUPABASE_KEY);
        return run({ ...context, adapters: createAdapters(supabase, context) });
      },
      // @ts-expect-error strings cannot be assigned to events
      manifest,
      { kernelPublicKey: env.KERNEL_PUBLIC_KEY, settingsSchema: pluginSettingsSchema, envSchema: envSchema }
    ).fetch(request, env, executionContext);
  },
};
