const serverless = require('serverless-http')

let handlerPromise

exports.handler = async (event, context) => {
  handlerPromise ||= import('../../backend/src/app.js')
    .then(({ default: app }) => serverless(app))

  const handler = await handlerPromise
  return handler(event, context)
}
