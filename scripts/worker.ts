/** Background worker: runs scheduled jobs every 60s. Deploy as a separate long-running process. */
import { runAllJobs } from "../src/server/modules/jobs";

async function loop() {
  for (;;) {
    const started = Date.now();
    const out = await runAllJobs().catch((e) => ({ error: String(e) }));
    if (Object.values(out).some((v) => v !== 0)) console.log(new Date().toISOString(), JSON.stringify(out));
    await new Promise((r) => setTimeout(r, Math.max(1000, 60_000 - (Date.now() - started))));
  }
}
loop();
