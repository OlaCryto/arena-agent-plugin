export type LogiqicalErrorCode =
  | "INSUFFICIENT_BALANCE"
  | "SLIPPAGE_EXCEEDED"
  | "TOKEN_NOT_FOUND"
  | "CONTRACT_REVERT"
  | "NO_LIQUIDITY"
  | "TX_FAILED"
  | "INVALID_ADDRESS"
  | "INVALID_AMOUNT"
  | "NO_WALLET"
  | "NETWORK_ERROR"
  | "API_ERROR"
  | "UNKNOWN";

export class LogiqicalError extends Error {
  constructor(
    message: string,
    public readonly code: LogiqicalErrorCode,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "LogiqicalError";
  }

  static from(e: unknown, code: LogiqicalErrorCode = "UNKNOWN"): LogiqicalError {
    if (e instanceof LogiqicalError) return e;
    const cause = e instanceof Error ? e : new Error(String(e));
    return new LogiqicalError(cause.message, code, cause);
  }
}
