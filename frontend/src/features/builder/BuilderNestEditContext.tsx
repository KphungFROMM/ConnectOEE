import { createContext, useContext, type ReactNode } from 'react'

type BuilderNestEditApi = {
  /** Render editable nested grid for a host widget (and optional tab). */
  renderNestedEdit: (parentId: string, tabKey?: string | null) => ReactNode
  /** Active tab key for a tabbed panel (builder chrome). */
  getActiveTab: (parentId: string) => string
  setActiveTab: (parentId: string, tabKey: string) => void
}

const BuilderNestEditContext = createContext<BuilderNestEditApi | null>(null)

export function BuilderNestEditProvider({
  value,
  children,
}: {
  value: BuilderNestEditApi
  children: ReactNode
}) {
  return <BuilderNestEditContext.Provider value={value}>{children}</BuilderNestEditContext.Provider>
}

export function useBuilderNestEdit() {
  return useContext(BuilderNestEditContext)
}
