const URLS = {
  GET: process.env.GET_ASSIGNMENTS_URL,
  POST: process.env.CREATE_ASSIGNMENT_URL,
  DELETE: process.env.RELEASE_ASSIGNMENT_URL,
}

function extractOwner(item) {
  const value = item?.AssignedTo ?? item?.AssignedToDisplayName ?? item?.AssignedTo?.DisplayName ?? item?.AssignedTo?.displayName
  if (typeof value === 'string') return value.includes(';') ? value.split(';')[0].trim() : value
  if (value && typeof value === 'object') return value.DisplayName || value.displayName || value.Email || value.email || ''
  return ''
}

function normaliseDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function normaliseTime(value) {
  if (!value) return ''
  const raw = String(value).trim()
  if (/^\d{2}:\d{2}$/.test(raw)) return raw
  const range = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i)
  if (!range) return raw
  let hour = Number(range[1]); const minute = Number(range[2] || 0); const meridiem = range[3]?.toUpperCase()
  if (meridiem === 'PM' && hour !== 12) hour += 12
  if (meridiem === 'AM' && hour === 12) hour = 0
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`
}

async function callFlow(url, body = {}) {
  if (!url) throw new Error('Required Power Automate URL is not configured in Vercel')
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

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const raw = await callFlow(URLS.GET, {})
      const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.value) ? raw.value : []
      const assignments = rows.map(item => ({
        id: item.ID ?? item.Id ?? item.id ?? '',
        date: normaliseDate(item.MeetingDate),
        time: normaliseTime(item.MeetingTime),
        owner: extractOwner(item),
      })).filter(item => item.date && item.time && item.owner)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ ok: true, assignments })
    }

    if (req.method === 'POST') {
      const { meetingDate, meetingTime, assignedToEmail, assignedToName } = req.body || {}
      if (!meetingDate || !meetingTime || !assignedToEmail) return res.status(400).json({ ok: false, error: 'meetingDate, meetingTime and assignedToEmail are required' })
      await callFlow(URLS.POST, {
        MeetingDate: meetingDate,
        MeetingTime: meetingTime,
        AssignedTo: assignedToEmail,
        AssignedToName: assignedToName || assignedToEmail,
      })
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const { meetingDate, meetingTime } = req.body || {}
      if (!meetingDate || !meetingTime) return res.status(400).json({ ok: false, error: 'meetingDate and meetingTime are required' })
      await callFlow(URLS.DELETE, { MeetingDate: meetingDate, MeetingTime: meetingTime })
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message })
  }
}
