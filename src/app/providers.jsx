import { BrowserRouter } from 'react-router'

export function AppProviders({ children }) {
  return <BrowserRouter>{children}</BrowserRouter>
}
