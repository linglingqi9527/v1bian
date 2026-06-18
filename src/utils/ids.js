import { nanoid } from 'nanoid'

export function createId(prefix) {
  return `${prefix}-${nanoid(10)}`
}
