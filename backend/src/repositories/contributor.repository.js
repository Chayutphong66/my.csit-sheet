import { db } from '../data/database.js'
import { calculateContributionScore, contributionBadges, contributorLevel } from '../services/contributionScore.service.js'

const contributorAggregate = `
  WITH published(document_type, id, uploader_id, view_count, download_count) AS (
    SELECT 'Lecture', id, uploader_id, view_count, download_count
    FROM lectures WHERE status = 'APPROVED'
    UNION ALL
    SELECT 'Sheet', id, uploader_id, view_count, download_count
    FROM sheets WHERE status = 'APPROVED'
  ),
  publication_rewards(user_id, rewarded_published) AS (
    SELECT user_id, COUNT(*)
    FROM upload_requests
    WHERE status = 'COMPLETED' AND rejection_type != 'DUPLICATE'
      AND duplicate_status NOT IN ('EXACT_DUPLICATE', 'CONTENT_DUPLICATE')
    GROUP BY user_id
  ),
  downloads(uploader_id, qualified_downloads) AS (
    SELECT published.uploader_id,
      COUNT(*)
    FROM published
    JOIN document_interactions interactions
      ON interactions.document_type = published.document_type AND interactions.document_id = published.id
    WHERE interactions.interaction_type = 'DOWNLOAD' AND interactions.user_id != published.uploader_id
    GROUP BY published.uploader_id
  ),
  helpful_votes(uploader_id, helpful) AS (
    SELECT published.uploader_id, COUNT(*)
    FROM published
    JOIN document_helpful_votes votes
      ON votes.document_type = published.document_type AND votes.document_id = published.id
    WHERE votes.user_id != published.uploader_id
    GROUP BY published.uploader_id
  )
  SELECT users.id, users.username,
    COALESCE(NULLIF(users.display_name, ''), users.username) AS display_name,
    users.avatar_url,
    COUNT(published.id) AS published_count,
    SUM(CASE WHEN published.document_type = 'Lecture' THEN 1 ELSE 0 END) AS lecture_count,
    SUM(CASE WHEN published.document_type = 'Sheet' THEN 1 ELSE 0 END) AS sheet_count,
    COALESCE(SUM(published.view_count), 0) AS total_views,
    COALESCE(SUM(published.download_count), 0) AS total_downloads,
    COALESCE(MAX(publication_rewards.rewarded_published), 0) AS rewarded_published,
    COALESCE(MAX(downloads.qualified_downloads), 0) AS qualified_downloads,
    COALESCE(MAX(helpful_votes.helpful), 0) AS helpful
  FROM users
  LEFT JOIN published ON published.uploader_id = users.id
  LEFT JOIN publication_rewards ON publication_rewards.user_id = users.id
  LEFT JOIN downloads ON downloads.uploader_id = users.id
  LEFT JOIN helpful_votes ON helpful_votes.uploader_id = users.id
`

function mapContributor(row) {
  if (!row) return null
  const published = Number(row.rewarded_published || 0)
  const qualifiedDownloads = Number(row.qualified_downloads || 0)
  const helpful = Number(row.helpful || 0)
  const contributionScore = calculateContributionScore({ published, qualifiedDownloads, helpful })
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || '',
    publishedCount: Number(row.published_count || 0),
    lectureCount: Number(row.lecture_count || 0),
    sheetCount: Number(row.sheet_count || 0),
    totalViews: Number(row.total_views || 0),
    totalDownloads: Number(row.total_downloads || 0),
    helpful,
    contributionScore,
    contributorLevel: contributorLevel(contributionScore),
    badges: contributionBadges({ published, qualifiedDownloads, helpful })
  }
}

export function searchContributors(query, limit = 20) {
  const term = `%${String(query ?? '').trim().toLowerCase()}%`
  return db.prepare(`
    ${contributorAggregate}
    WHERE users.role = 'USER' AND (
      lower(users.username) LIKE ? OR lower(COALESCE(NULLIF(users.display_name, ''), users.username)) LIKE ?
    )
    GROUP BY users.id, users.username, users.display_name, users.avatar_url
    ORDER BY published_count DESC, users.username
    LIMIT ?
  `).all(term, term, Math.min(Math.max(Number(limit) || 20, 1), 20)).map(mapContributor)
}

export function findContributorByUsername(username) {
  return mapContributor(db.prepare(`
    ${contributorAggregate}
    WHERE users.role = 'USER' AND lower(users.username) = lower(?)
    GROUP BY users.id, users.username, users.display_name, users.avatar_url
    LIMIT 1
  `).get(String(username ?? '').trim()))
}
