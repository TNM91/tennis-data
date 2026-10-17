/** Read the intended directory window despite the database's per-request row cap. */
export async function loadTeamDirectoryPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const data: T[] = []
  const pageSize = 1000
  for (let from = 0; from < 10000; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1)
    if (page.error) return { data: null, error: page.error }
    const rows = page.data || []
    data.push(...rows)
    if (rows.length < pageSize) break
  }
  return { data, error: null }
}
