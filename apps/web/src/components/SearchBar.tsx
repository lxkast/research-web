import { useState, type FormEvent } from "react"
import { useStore } from "../store/index.ts"
import { explore } from "../lib/api.ts"

export function SearchBar() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const sessionId = useStore((s) => s.sessionId)
  const reset = useStore((s) => s.reset)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const name = query.trim()
    if (!name || loading) return

    reset()
    setLoading(true)
    try {
      await explore(name, sessionId)
    } catch (err) {
      console.error("explore failed:", err)
    } finally {
      setLoading(false)
    }
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
