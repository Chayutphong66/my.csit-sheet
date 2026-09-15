export const CONTRIBUTION_SCORE = Object.freeze({
  CONTRIBUTION_APPROVED_POINTS: 20,
  QUALIFIED_DOWNLOAD_POINTS: 2,
  HELPFUL_POINTS: 5
})

const LEVELS = Object.freeze([
  { minimum: 300, name: 'Trusted Contributor' },
  { minimum: 100, name: 'Knowledge Contributor' },
  { minimum: 20, name: 'Contributor' },
  { minimum: 0, name: 'New Contributor' }
])

export function calculateContributionScore({ published = 0, qualifiedDownloads = 0, helpful = 0 }) {
  return published * CONTRIBUTION_SCORE.CONTRIBUTION_APPROVED_POINTS
    + qualifiedDownloads * CONTRIBUTION_SCORE.QUALIFIED_DOWNLOAD_POINTS
    + helpful * CONTRIBUTION_SCORE.HELPFUL_POINTS
}

export function contributorLevel(score) {
  return LEVELS.find((level) => Number(score) >= level.minimum).name
}

export function contributionBadges({ published = 0, qualifiedDownloads = 0, helpful = 0 }) {
  const badges = []
  if (published >= 1) badges.push('First Contribution')
  if (published >= 5) badges.push('5 Contributions')
  if (qualifiedDownloads >= 100) badges.push('100 Downloads')
  if (helpful >= 10) badges.push('Helpful Contributor')
  return badges
}
