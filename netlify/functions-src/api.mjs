import serverless from 'serverless-http'

let handlerPromise

export async function handler(event, context) {
  // The imported app selects Netlify Postgres at runtime; local SQLite stays unbundled.
  handlerPromise ||= import('../../backend/src/app.js')
    .then(({ default: app }) => serverless(app))

  const expressHandler = await handlerPromise
  return expressHandler(event, context)
}
