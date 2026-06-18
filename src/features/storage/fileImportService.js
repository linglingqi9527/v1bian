export function parseImportPayload(payload) {
  if (!payload || payload.version !== 1 || !payload.snapshot) {
    throw new Error('Unsupported import payload')
  }

  return payload.snapshot
}
