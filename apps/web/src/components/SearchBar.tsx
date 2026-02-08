import { useState, type FormEvent } from "react"
import { Effect } from "effect"
import { useStore } from "../store/index.ts"
import { searchResearcher } from "../lib/actions.ts"

export function SearchBar() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const sessionId = useStore((s) => s.sessionId)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const name = query.trim()
    if (!name || loading) return

    setLoading(true)
    await Effect.runPromise(
      searchResearcher(name, sessionId).pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => console.error("explore failed:", error._tag, error.message))
        ),
        Effect.ensuring(Effect.sync(() => setLoading(false)))
      )
    )
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Search for a researcher…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={loading}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Searching…" : "Search"}
      </button>
    </form>
  )
}
