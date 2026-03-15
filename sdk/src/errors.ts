/** Error returned by the Logiqical API */
export class LogiqicalError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
  ) {
    super(message);
    this.name = "LogiqicalError";
  }
}

/** Authentication error — invalid or missing API key */
export class LogiqicalAuthError extends LogiqicalError {
  constructor(endpoint: string) {
    super("Invalid or missing API key. Call client.register() or provide an apiKey in config.", 401, endpoint);
    this.name = "LogiqicalAuthError";
  }
}
