import * as cheerio from 'cheerio'

const DEFAULT_SOURCE = 'https://outlook.office365.com/calendar/published/675621241b7c4d238852dc4508f6764c@dxc.com/df97f590c5e24b0bba39b8fed1b84d702306156400361748759/calendar.html'

function clean(value = '') {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractDate(text) {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const au = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/)
  if (au) return `${au[3]}-${String(au[2]).padStart(2,'0')}-${String(au[1]).padStart(2,'0')}`
  return null
}

function to24(hour, minute, meridiem) {
  let h = Number(hour)
  if (meridiem?.toLowerCase() === 'pm' && h !== 12) h += 12
  if (meridiem?.toLowerCase() === 'am' && h === 12) h = 0
  return `${String(h).padStart(2,'0')}:${String(minute || 0).padStart(2,'0')}`
}

function extractTime(text) {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
  return match ? to24(match[1], match[2], match[3]) : null
}

function parseBusyEvents(html) {
  const $ = cheerio.load(html)
  const candidates = []
  $('body *').each((_, el) => {
    const own = clean($(el).clone().children().remove().end().text())
    if (!/\bbusy\b/i.test(own) || /\btentative\b/i.test(own)) return
    const parentText = clean($(el).parent().text()).slice(0, 600)
    const date = extractDate(parentText)
    const time = extractTime(parentText)
    if (date && time) candidates.push({ date, time, title: 'CPSR Meeting', sourceState: 'Busy' })
  })

  // Some published calendars place event data inside scripts rather than visible nodes.
  $('script').each((_, el) => {
    const text = clean($(el).html() || '')
    if (!/busy/i.test(text) || /tentative/i.test(text)) return
    const date = extractDate(text)
    const time = extractTime(text)
    if (date && time) candidates.push({ date, time, title: 'CPSR Meeting', sourceState: 'Busy' })
  })

  return [...new Map(candidates.map(item => [`${item.date}-${item.time}`, item])).values()]
}

export default async function handler(req, res) {
  try {
    const source = typeof req.query?.source === 'string' ? req.query.source : DEFAULT_SOURCE
    const response = await fetch(source, { headers: { 'user-agent': 'Mozilla/5.0 Live Minutes Roster' } })
    if (!response.ok) throw new Error(`Calendar returned ${response.status}`)
    const html = await response.text()
    const events = parseBusyEvents(html)
    res.setHeader('Cache-Control', 's-maxage=240, stale-while-revalidate=60')
    res.status(200).json({ ok: true, source, fetchedAt: new Date().toISOString(), events, busyOnly: true, tentativeIgnored: true })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message, events: [] })
  }
}
