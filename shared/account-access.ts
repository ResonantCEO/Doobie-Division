/** These accounts can authenticate, but may use only their own support tickets. */
export function isSupportOnlyAccount(status: string | null | undefined): boolean {
  return status === "pending" || status === "suspended";
}

export function supportOnlyAccessMessage(status: string): string {
  return status === "suspended"
    ? "Your account is suspended. Only support tickets are available."
    : "Your account is pending approval. Only support tickets are available.";
}