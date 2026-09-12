process.env.RUN_DB_SEED = '1'

const { db } = await import('./database.js')
db.close()

console.log('Database seed complete')
