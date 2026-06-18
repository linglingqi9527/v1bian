import { MobileNav } from './MobileNav.jsx'
import { SideNav } from './SideNav.jsx'
import { HandDrawnAppFrame } from '../handdrawn/HandDrawnAppFrame.jsx'

export function AppShell({ children }) {
  return (
    <div className="app-shell">
      <SideNav />
      <main className="app-main">{children}</main>
      <MobileNav />
      <HandDrawnAppFrame />
    </div>
  )
}
