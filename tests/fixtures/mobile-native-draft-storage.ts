const prefix = 'synthetic-native:'

export function getNativeAuthStorage() {
  if (!new URL(location.href).searchParams.has('secure-score-drafts')) return undefined
  return {
    getItem: (key: string) => sessionStorage.getItem(prefix + key),
    setItem: (key: string, value: string) => sessionStorage.setItem(prefix + key, value),
    removeItem: (key: string) => sessionStorage.removeItem(prefix + key),
  }
}
