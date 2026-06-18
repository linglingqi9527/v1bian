import { useCallback } from 'react'
import { writeLocalDb } from '../features/storage/localDb.js'

export function useLocalSave() {
  return useCallback((snapshot) => {
    writeLocalDb(snapshot)
  }, [])
}
