export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type TimeoutSignal = {
  signal: AbortSignal;
  cancel: () => void;
};

export function createTimeoutSignal(timeoutMs: number): TimeoutSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}
