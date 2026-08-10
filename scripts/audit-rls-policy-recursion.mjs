import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

function migrationFiles(inputPaths) {
  const files = []

  for (const inputPath of inputPaths) {
    const resolved = path.resolve(inputPath)
    if (!existsSync(resolved)) throw new Error(`Migration path does not exist: ${resolved}`)

    if (statSync(resolved).isDirectory()) {
      for (const entry of readdirSync(resolved)) {
        if (entry.endsWith('.sql')) files.push(path.join(resolved, entry))
      }
    } else if (resolved.endsWith('.sql')) {
      files.push(resolved)
    }
  }

  return files.sort((left, right) => path.basename(left).localeCompare(path.basename(right)))
}

function policyKey(table, name) {
  return `${table.toLowerCase()}::${name.trim().toLowerCase()}`
}

function parseEffectivePolicyGraph(files) {
  const rlsTables = new Set()
  const policies = new Map()

  for (const file of files) {
    const source = readFileSync(file, 'utf8')

    for (const match of source.matchAll(/alter\s+table\s+(?:public\.)?"?([a-z0-9_]+)"?\s+enable\s+row\s+level\s+security\s*;/gi)) {
      rlsTables.add(match[1].toLowerCase())
    }

    for (const match of source.matchAll(/drop\s+policy\s+if\s+exists\s+(?:"([^"]+)"|([a-z0-9_]+))\s+on\s+(?:public\.)?"?([a-z0-9_]+)"?\s*;/gi)) {
      policies.delete(policyKey(match[3], match[1] || match[2]))
    }

    for (const match of source.matchAll(/create\s+policy\s+(?:"([^"]+)"|([a-z0-9_]+))\s+on\s+(?:public\.)?"?([a-z0-9_]+)"?([\s\S]*?);/gi)) {
      const name = match[1] || match[2]
      const table = match[3].toLowerCase()
      const body = match[4]
      const references = new Set()

      for (const reference of body.matchAll(/(?:from|join)\s+(?:only\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
        references.add(reference[1].toLowerCase())
      }

      policies.set(policyKey(table, name), {
        file: path.basename(file),
        name,
        references,
        table,
      })
    }
  }

  const graph = new Map([...rlsTables].map((table) => [table, new Set()]))
  for (const policy of policies.values()) {
    if (!graph.has(policy.table)) continue
    for (const reference of policy.references) {
      if (rlsTables.has(reference)) graph.get(policy.table).add(reference)
    }
  }

  return { graph, policies, rlsTables }
}

function stronglyConnectedComponents(graph) {
  const components = []
  const indexes = new Map()
  const lowLinks = new Map()
  const stack = []
  const onStack = new Set()
  let nextIndex = 0

  function visit(node) {
    indexes.set(node, nextIndex)
    lowLinks.set(node, nextIndex)
    nextIndex += 1
    stack.push(node)
    onStack.add(node)

    for (const neighbor of graph.get(node) || []) {
      if (!indexes.has(neighbor)) {
        visit(neighbor)
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(neighbor)))
      } else if (onStack.has(neighbor)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indexes.get(neighbor)))
      }
    }

    if (lowLinks.get(node) !== indexes.get(node)) return

    const component = []
    let current
    do {
      current = stack.pop()
      onStack.delete(current)
      component.push(current)
    } while (current !== node)
    components.push(component.sort())
  }

  for (const node of graph.keys()) {
    if (!indexes.has(node)) visit(node)
  }

  return components.filter((component) => {
    if (component.length > 1) return true
    const [table] = component
    return graph.get(table)?.has(table)
  })
}

function main() {
  const inputs = process.argv.slice(2)
  const migrationPaths = inputs.length > 0 ? inputs : [path.join(process.cwd(), 'supabase', 'migrations')]
  const files = migrationFiles(migrationPaths)
  const { graph, policies, rlsTables } = parseEffectivePolicyGraph(files)
  const cycles = stronglyConnectedComponents(graph)

  if (cycles.length === 0) {
    console.log(`RLS policy recursion audit passed (${rlsTables.size} protected tables, ${policies.size} effective policies).`)
    return
  }

  console.error('RLS policy recursion audit failed:')
  for (const component of cycles) {
    console.error(`- protected-table cycle: ${component.join(' -> ')} -> ${component[0]}`)
    const tables = new Set(component)
    for (const policy of policies.values()) {
      if (!tables.has(policy.table)) continue
      const cyclicReferences = [...policy.references].filter((reference) => tables.has(reference))
      if (cyclicReferences.length > 0) {
        console.error(`  ${policy.table} / ${policy.name} (${policy.file}) -> ${cyclicReferences.join(', ')}`)
      }
    }
  }
  process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : 'RLS policy recursion audit failed.')
  process.exitCode = 1
}
