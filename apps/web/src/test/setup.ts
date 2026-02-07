import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"
import { useStore } from "../store/index.ts"

afterEach(() => {
  cleanup()
  useStore.getState().reset()
})
