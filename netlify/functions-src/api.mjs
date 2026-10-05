import serverless from 'serverless-http'

let handlerPromise

export async function handler(event, context) {
  handlerPromise ||= import('../../backend/src/app.js')
    .then(({ default: app }) => serverless(app))

  const expressHandler = await handlerPromise
  return expressHandler(event, context)
}
