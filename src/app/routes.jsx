import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '../design-system/layout/AppShell.jsx'
import HomePage from '../pages/HomePage.jsx'
import JudgePage from '../pages/JudgePage.jsx'
import MatchDetailPage from '../pages/MatchDetailPage.jsx'
import MatchesPage from '../pages/MatchesPage.jsx'
import ProfilePage from '../pages/ProfilePage.jsx'
import ReviewDetailPage from '../pages/ReviewDetailPage.jsx'
import ReviewEditorPage from '../pages/ReviewEditorPage.jsx'
import ReviewsPage from '../pages/ReviewsPage.jsx'
import TrainingCreatePage from '../pages/TrainingCreatePage.jsx'
import TrainingDetailPage from '../pages/TrainingDetailPage.jsx'
import TrainingsPage from '../pages/TrainingsPage.jsx'

export function AppRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/matches/:matchId" element={<MatchDetailPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/reviews/new/edit" element={<ReviewEditorPage />} />
        <Route path="/reviews/:reviewId" element={<ReviewDetailPage />} />
        <Route path="/reviews/:reviewId/edit" element={<ReviewEditorPage />} />
        <Route path="/reviews/match/:matchId/edit" element={<ReviewEditorPage />} />
        <Route path="/trainings" element={<TrainingsPage />} />
        <Route path="/trainings/new" element={<TrainingCreatePage />} />
        <Route path="/trainings/:trainingId" element={<TrainingDetailPage />} />
        <Route path="/judge" element={<JudgePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
