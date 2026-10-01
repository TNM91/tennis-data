export function buildLocationDirectionsHref(location: unknown) {
  const destination = typeof location === 'string' ? location.replace(/\s+/g, ' ').trim() : ''
  return destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
    : ''
}
