/**
 * Minimal Google Analytics Measurement Protocol reporter.
 *
 * Replacement for deno.land/x/g_a so the package can publish to JSR without
 * non-JSR https imports.
 *
 * @module
 */

/** Narrow connection info used for client IP reporting. */
export interface Conn {
  readonly remoteAddr: Deno.Addr;
}

/** Optional measurement metadata. */
export interface MetaData {
  campaignMedium?: string;
  campaignSource?: string;
  documentTitle?: string;
}

/** Reporter invoked after a request is handled. */
export interface Reporter {
  (
    req: Request,
    conn: Conn,
    res: Response,
    start: number,
    error?: unknown,
  ): Promise<void> | void;
}

export interface CreateReporterOptions {
  /** GA tracking / measurement property ID. */
  id: string;
}

/**
 * Create a fire-and-forget GA reporter.
 *
 * @param options Reporter options including the GA property id
 */
export function createReporter(options: CreateReporterOptions): Reporter {
  const tid = options.id;
  return (req, conn, res, start, error) => {
    // Non-blocking best-effort beacon; failures are ignored.
    queueMicrotask(() => {
      try {
        const url = new URL(req.url);
        const remote = conn.remoteAddr;
        const uip = remote.transport === "tcp" || remote.transport === "udp"
          ? remote.hostname
          : "";
        const params = new URLSearchParams({
          v: "1",
          tid,
          t: error ? "exception" : "pageview",
          cid: uip || "anonymous",
          uip,
          dl: url.href,
          dt: res.headers.get("content-type") ?? "",
          srt: String(Math.max(0, Math.round(performance.now() - start))),
          ua: req.headers.get("user-agent") ?? "",
        });
        if (error) {
          params.set(
            "exd",
            error instanceof Error ? error.message : String(error),
          );
          params.set("exf", "1");
        }
        // Measurement Protocol collect endpoint (legacy UA still accepted by many properties)
        fetch("https://www.google-analytics.com/collect", {
          method: "POST",
          body: params.toString(),
          headers: {
            "content-type": "application/x-www-form-urlencoded",
          },
        }).catch(() => {});
      } catch {
        // ignore reporter errors
      }
    });
  };
}

export type { Reporter as GaReporter };
