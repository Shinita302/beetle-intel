export async function deleteAccount(): Promise<void> {
  const response = await fetch('/api/account/delete', { method: 'POST' });

  let body: { error?: string } = {};
  try {
    body = (await response.json()) as { error?: string };
  } catch {
    // ignore JSON parse errors
  }

  if (!response.ok) {
    throw new Error(body.error ?? 'Could not delete account.');
  }
}
