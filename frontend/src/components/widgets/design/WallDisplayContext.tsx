import { createContext, useContext } from 'react'

/** True when rendering a floor wall / kiosk full-viewport board. */
export const WallDisplayContext = createContext(false)

export function useWallDisplay(): boolean {
  return useContext(WallDisplayContext)
}
