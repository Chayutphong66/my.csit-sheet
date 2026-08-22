import app from './app.js'

const port = process.env.PORT ?? 8080

app.listen(port, () => {
  console.log(`CSIT Sheet API running on http://127.0.0.1:${port}`)
})
