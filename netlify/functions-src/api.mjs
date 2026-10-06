import serverless from 'serverless-http'
import './legacyEnvironment.mjs'

let handlerPromise

export async function handler(event, context) {
  // Transitional Netlify wrapper; provider configuration belongs only in this adapter.
  handlerPromise ||= import('../../backend/src/app.js')
    .then(({ default: app }) => serverless(app))

  const expressHandler = await handlerPromise
  return expressHandler(event, context)
}
