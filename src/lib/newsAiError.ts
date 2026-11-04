/** Preserve the safe service message instead of the generic invocation error. */
export async function newsAiError(error: unknown): Promise<string> {
  if (error && typeof error === "object" && "context" in error && error.context instanceof Response) {
    try {
      const body = await error.context.clone().json();
      const message = body.error || body.message;
      if (typeof message === "string") return message;
    } catch { /* Fall back for non-JSON network failures. */ }
  }
  return error instanceof Error ? error.message : "Nie udało się połączyć z usługą AI.";
}