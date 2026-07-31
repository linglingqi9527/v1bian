import { usePageViewTracking } from '../features/analytics/index.js'
import { AppProviders } from './providers.jsx'
import { AppRoutes } from './routes.jsx'

export default function App() {
  return (
    <AppProviders>
      <AnalyticsRuntime />
      <AppRoutes />
    </AppProviders>
  )
}

function AnalyticsRuntime() {
  usePageViewTracking()
  return null
}
