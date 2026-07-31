import { HashRouter } from 'react-router'

export function AppProviders({ children }) {
  return <HashRouter>{children}</HashRouter>
}
