export class ParseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

export function userFacingError(err: unknown): string {
  if (err instanceof ParseError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong while parsing your file.";
}
