import { useEffect } from "react"
import { useStore } from "../store/index.ts"

export function ErrorToast() {
  const errors = useStore((s) => s.errors)
  const dismissError = useStore((s) => s.dismissError)

  return (
    <div className="error-toast-container">
      {errors.map((err) => (
        <Toast key={err.id} id={err.id} message={err.message} onDismiss={dismissError} />
      ))}
    </div>
  )
}

function Toast({ id, message, onDismiss }: { id: string; message: string; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 5000)
    return () => clearTimeout(timer)
  }, [id, onDismiss])

  return (
    <div className="error-toast">
      <span>{message}</span>
      <button className="error-toast-dismiss" onClick={() => onDismiss(id)}>
        &times;
      </button>
    </div>
  )
}
