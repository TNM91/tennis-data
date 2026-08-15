export function apiServerError(context: string, error: unknown, message: string) {
  console.error(context, error)
  return Response.json({ ok: false, message }, { status: 500 })
}
