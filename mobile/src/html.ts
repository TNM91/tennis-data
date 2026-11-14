const entities: Record<string,string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export const html = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => entities[character])
