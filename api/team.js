const URLS = {
  GET: process.env.GET_TEAM_URL,
  POST: process.env.ADD_TEAM_MEMBER_URL,
  DELETE: process.env.REMOVE_TEAM_MEMBER_URL,
}

async function callFlow(url, body = {}) {
  if (!url) throw new Error('Required team Power Automate URL is not configured in Vercel')
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Power Automate returned ${response.status}: ${text.slice(0, 300)}`)
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

function normaliseMember(item) {
  const person = item?.Member ?? item?.TeamMember ?? item?.Person
  function normaliseMember(item) {
  return {
    id: String(item.ID || ''),
    name: String(item.Title || ''),
    email: String(item.Email || '').toLowerCase(),
    active: item.Active === true
  };
}
  const email = item?.Email ?? item?.MemberEmail ?? person?.Email ?? person?.email ?? ''
  const activeValue = item?.Active
  const active = activeValue === undefined || activeValue === null
    ? true
    : activeValue === true || String(activeValue).toLowerCase() === 'true' || String(activeValue) === '1'
  return { id: String(item?.ID ?? item?.Id ?? item?.id ?? ''), name: String(name).trim(), email: String(email).trim().toLowerCase(), active }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const raw = await callFlow(URLS.GET, {})
      const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.value) ? raw.value : []
      const members = rows.map(normaliseMember).filter(member => member.id && member.name && member.email && member.active)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ ok: true, members })
    }

    if (req.method === 'POST') {
      const { name, email } = req.body || {}
      if (!name || !email) return res.status(400).json({ ok: false, error: 'name and email are required' })
      await callFlow(URLS.POST, { DisplayName: String(name).trim(), Email: String(email).trim().toLowerCase(), Active: true })
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const { id, email } = req.body || {}
      if (!id && !email) return res.status(400).json({ ok: false, error: 'id or email is required' })
      await callFlow(URLS.DELETE, { ID: id || '', Email: email || '' })
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message })
  }
}
