export async function subscribeToHaycNewsletter(email: string): Promise<void> {
  try {
    await fetch("/api/hayc/newsletter-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  } catch {
    // Non-blocking — lead submission should still succeed
  }
}
