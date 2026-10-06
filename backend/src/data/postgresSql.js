// Transform only SQL tokens, never quoted values, identifiers or comments.
const protectedSql = /('(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/|\bgroup_concat\(\w+,\s*', '\))/gi
export const utcNowSql = "to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')"

export function toPostgresQuery(source, parameters = []) {
  const named = parameters.length === 1 && parameters[0] && typeof parameters[0] === 'object' && !Array.isArray(parameters[0]) && !ArrayBuffer.isView(parameters[0])
  const values = named ? [] : parameters
  const indexes = new Map()
  let positionalIndex = 0
  const ignore = /^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(source)
  // This aggregate is used by document attribution; quoted SQL/comments stay opaque.
  let sql = source.split(protectedSql).map((part, index) => {
    if (index % 2) return /^group_concat\(/i.test(part) ? part.replace(/^group_concat/i, 'string_agg') : part
    return part
      .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')
      .replace(/\s+COLLATE\s+NOCASE/gi, '')
      .replace(/\bLIKE\b/gi, 'ILIKE')
      .replace(/\bCURRENT_TIMESTAMP\b/gi, utcNowSql)
      .replace(named ? /@([A-Za-z_][A-Za-z0-9_]*)/g : /\?/g, (_match, name) => {
        if (!named) return `$${++positionalIndex}`
        if (!Object.hasOwn(parameters[0], name)) throw new Error('Missing named SQL parameter')
        if (!indexes.has(name)) { indexes.set(name, values.length + 1); values.push(parameters[0][name]) }
        return `$${indexes.get(name)}`
      })
  }).join('')
  if (ignore && !/ON\s+CONFLICT/i.test(sql)) sql = `${sql.trim().replace(/;$/, '')} ON CONFLICT DO NOTHING`
  return { sql, parameters: values }
}
