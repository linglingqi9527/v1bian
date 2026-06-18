export function assertDefined(value, message = 'Expected value to be defined') {
  if (value === undefined || value === null) {
    throw new Error(message)
  }

  return value
}
