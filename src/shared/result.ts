export type Result<T, E = ResultError> = { ok: true; value: T } | { ok: false; error: E };

export interface ResultError {
  code: string;
  message: string;
}

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = (code: string, message: string): Result<never> => ({
  ok: false,
  error: { code, message },
});

export const okVoid = (): Result<void, never> => ({ ok: true, value: undefined });
