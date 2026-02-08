export async function explore(
  name: string,
  sessionId: string
): Promise<{ sessionId: string }> {
  const res = await fetch("/api/explore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, sessionId }),
  })
  if (!res.ok) {
    throw new Error(`explore failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}
