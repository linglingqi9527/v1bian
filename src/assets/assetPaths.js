import heroIllustration from './illustrations/hero-bianleme-01.png'
import logoMark from './logo/logo.png'
import decorStrokeBlue from './handdrawn-shapes/decor-stroke-blue-01.png'
import decorStrokeGreen from './handdrawn-shapes/decor-stroke-green-01.png'
import decorStrokePink from './handdrawn-shapes/decor-stroke-pink-01.png'
import decorStrokeYellow from './handdrawn-shapes/decor-stroke-yellow-01.png'
import matchStartTrainingIcon from './icons/match-card/match-card-start-training-v2.png'
import matchWatchVideoIcon from './icons/match-card/match-card-watch-video.png'
import matchWriteReviewIcon from './icons/match-card/match-card-write-review.png'
import navStartTrainingIcon from './icons/nav/nav-start-training.png'
import navWatchMatchIcon from './icons/nav/nav-watch-match-house-v2.png'
import navWriteReviewIcon from './icons/nav/nav-write-review.png'
import trainingSaveIcon from './icons/training/training-save-floppy-cutout.png'

export const imageAssets = {
  heroIllustration,
  logoMark,
  // Shared decorative marker strokes for match-card accents and future hand-drawn details.
  handdrawnShapes: {
    decorStroke: {
      blue: decorStrokeBlue,
      green: decorStrokeGreen,
      pink: decorStrokePink,
      yellow: decorStrokeYellow,
    },
  },
  // Icons used by the action buttons on each match card.
  matchCard: {
    startTraining: matchStartTrainingIcon,
    watchVideo: matchWatchVideoIcon,
    writeReview: matchWriteReviewIcon,
  },
  // Icons used by the left and mobile navigation.
  nav: {
    watchMatch: navWatchMatchIcon,
    writeReview: navWriteReviewIcon,
    startTraining: navStartTrainingIcon,
  },
  // Icons used inside training creation and training detail flows.
  training: {
    save: trainingSaveIcon,
  },
}
