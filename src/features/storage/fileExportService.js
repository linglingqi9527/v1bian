export function createExportPayload(snapshot) {
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    snapshot,
  }
}
