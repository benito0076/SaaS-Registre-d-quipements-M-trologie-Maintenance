export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  /** Retourne false pour abandonner immédiatement (erreur non transitoire). */
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Exécute `fn` avec reprises et temporisation exponentielle (base, 2×base, 4×base…). */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<{ value: T; attempts: number }> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 1000;
  const sleep = opts.sleep ?? defaultSleep;
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      return { value: await fn(attempt), attempts: attempt };
    } catch (e) {
      if (attempt > retries || (opts.shouldRetry && !opts.shouldRetry(e))) {
        if (e && typeof e === "object") (e as { attempts?: number }).attempts = attempt;
        throw e;
      }
      opts.onRetry?.(e, attempt);
      await sleep(base * 2 ** (attempt - 1));
    }
  }
}
