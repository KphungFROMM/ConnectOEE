import type { WidgetMeta } from './registry'
import type { ComponentType } from 'react'
import type { WidgetProps } from './common'

/**
 * Validates widget catalog integrity — every catalog entry must resolve in the registry
 * and every registry key should appear in the catalog.
 */
export function assertWidgetCatalogIntegrity(
  catalog: WidgetMeta[],
  registry: Record<string, ComponentType<WidgetProps>>,
): void {
  const errors: string[] = []
  const catalogTypes = new Set(catalog.map((w) => w.type))
  const registryTypes = new Set(Object.keys(registry))

  for (const meta of catalog) {
    if (!registry[meta.type]) {
      errors.push(`Catalog entry "${meta.type}" has no matching widgetRegistry component`)
    }
    if (meta.defaultW < 1 || meta.defaultH < 1) {
      errors.push(`Catalog entry "${meta.type}" has invalid default size`)
    }
  }

  for (const type of registryTypes) {
    if (!catalogTypes.has(type)) {
      errors.push(`Registry entry "${type}" is missing from widgetCatalog`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`Widget catalog validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  }
}
