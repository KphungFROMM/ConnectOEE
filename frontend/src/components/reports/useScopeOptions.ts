import { useEffect, useState } from 'react'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'
import type { ScopeOption } from './reportConstants'

export function useScopeOptions() {
  const [options, setOptions] = useState<ScopeOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getHierarchyTree()
      .then((tree: PlantNode[]) => {
        const opts: ScopeOption[] = []
        for (const p of tree) {
          opts.push({ value: `Plant:${p.id}`, label: `🏭 ${p.name}`, level: 'Plant', id: p.id })
          for (const d of p.departments) {
            opts.push({ value: `Department:${d.id}`, label: `　🏢 ${d.name}`, level: 'Department', id: d.id })
            for (const l of d.lines) {
              opts.push({ value: `Line:${l.id}`, label: `　　🔧 ${l.name}`, level: 'Line', id: l.id })
              for (const m of l.machines)
                opts.push({ value: `Machine:${m.id}`, label: `　　　⚙ ${m.name}`, level: 'Machine', id: m.id })
            }
          }
        }
        setOptions(opts)
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false))
  }, [])

  return { options, loading }
}
