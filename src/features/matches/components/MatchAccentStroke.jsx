import { imageAssets } from '../../../assets/assetPaths.js'

const MATCH_ACCENT_SEQUENCE = ['yellow', 'blue', 'pink', 'green']

export function MatchAccentStroke({ index }) {
  const accent = MATCH_ACCENT_SEQUENCE[index % MATCH_ACCENT_SEQUENCE.length]
  const src = imageAssets.handdrawnShapes.decorStroke[accent] ?? imageAssets.handdrawnShapes.decorStroke.yellow

  return <img alt="" className="match-card__accent" src={src} />
}
