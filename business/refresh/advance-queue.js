export function createAdvanceQueue(env = {}) {
  let busy = false;
  let pendingDate = null;

  async function execute(options) {
    const steps = env.plan?.(options) || [];
    if (!steps.length) return { status: "skipped", reason: "empty" };
    const results = [];
    for (const step of steps) {
      if (step === "shift") {
        const shifted = env.shift?.(options);
        results.push({
          step,
          status: shifted === false ? "unchanged" : "updated",
        });
        continue;
      }
      if (step === "fill") {
        results.push({
          step,
          ...((await env.fill?.(options)) || { status: "skipped" }),
        });
        continue;
      }
      if (step === "lines") {
        results.push({
          step,
          ...((await env.lines?.(options)) || { status: "skipped" }),
        });
      }
    }
    return { status: "updated", results };
  }

  async function safelyExecute(options) {
    try {
      return await execute(options);
    } catch (error) {
      try {
        env.onError?.(error, options);
      } catch {}
      return { status: "failed", error };
    }
  }

  async function drain(firstOptions) {
    busy = true;
    const firstResult = await safelyExecute(firstOptions);
    while (pendingDate) {
      const queued = pendingDate;
      pendingDate = null;
      const result = await safelyExecute(queued.options);
      queued.resolve(result);
    }
    busy = false;
    return firstResult;
  }

  function run(options = {}) {
    if (!busy) return drain(options);
    if (options.trigger !== "date")
      return Promise.resolve({ status: "skipped", reason: "busy" });
    if (pendingDate)
      pendingDate.resolve({
        status: "skipped",
        reason: "superseded",
        supersededBy: options.messageId ?? null,
      });
    return new Promise((resolve) => {
      pendingDate = { options, resolve };
    });
  }

  return {
    run,
    get busy() {
      return busy;
    },
  };
}
