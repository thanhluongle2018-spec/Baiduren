import { engineErrorMessage, type EngineErrorCode } from "@/lib/speedtest/metrics";

export class SpeedTestEngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message = engineErrorMessage(code)) {
    super(message);
    this.name = "SpeedTestEngineError";
    this.code = code;
  }
}

export function isSpeedTestEngineError(error: unknown): error is SpeedTestEngineError {
  return error instanceof SpeedTestEngineError;
}
