/** Quote PostgREST filter values and treat wildcard characters as literal search text. */
export function playerDirectorySearchFilter(search: string) {
  const value = search.trim()
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/"/g, '\\"')
  return `name.ilike."%${value}%",location.ilike."%${value}%"`
}
