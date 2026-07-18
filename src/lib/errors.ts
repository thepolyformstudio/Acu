export function safeError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes("__CANCELLED__")) return msg;
    if (msg.includes("429") || msg.includes("quota") || msg.includes("rate limit")) {
      return "You have exceeded the API rate limit. Please wait and try again.";
    }
    if (msg.includes("auth/") || msg.includes("Firebase")) {
      return "Authentication failed. Please check your credentials.";
    }
    if (msg.includes("NetworkError") || msg.includes("Failed to fetch")) {
      return "Network error. Please check your internet connection.";
    }
    if (msg.length > 0 && msg.length < 200) return msg;
  }
  return fallback;
}

export function logError(context: string, err: unknown): void {
  if (typeof console !== "undefined") {
    console.error(`[Acu Error] ${context}:`, err);
  }
}
