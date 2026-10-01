export class SlidingWindowRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  consume(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ): boolean {
    const cutoff = now - windowMs;
    const recent = (this.attempts.get(key) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );

    if (recent.length >= limit) {
      this.attempts.set(key, recent);
      return false;
    }

    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }

  clearPrefix(prefix: string): void {
    for (const key of this.attempts.keys()) {
      if (key.startsWith(prefix)) {
        this.attempts.delete(key);
      }
    }
  }
}
