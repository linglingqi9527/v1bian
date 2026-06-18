export const DEMO_USER_ID = 'demo-user'

export function createUserModel(user = {}) {
  return {
    id: user.id ?? DEMO_USER_ID,
    name: user.name ?? 'Demo User',
  }
}
