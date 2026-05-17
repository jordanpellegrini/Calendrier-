import ICAL from 'ical.js'

export function parseICS(icsContent) {
  try {
    const jcalData = ICAL.parse(icsContent)
    const comp = new ICAL.Component(jcalData)
    const vevents = comp.getAllSubcomponents('vevent')
    
    return vevents.map(vevent => {
      const event = new ICAL.Event(vevent)
      const isAllDay = event.startDate.isDate
      
      let startAt, endAt
      
      if (isAllDay) {
        // Pour les événements all-day, on stocke à minuit local
        const s = event.startDate
        const e = event.endDate
        startAt = new Date(s.year, s.month - 1, s.day, 0, 0, 0).toISOString()
        endAt = new Date(e.year, e.month - 1, e.day, 23, 59, 59).toISOString()
      } else {
        startAt = event.startDate.toJSDate().toISOString()
        endAt = event.endDate.toJSDate().toISOString()
      }
      
      return {
        title: event.summary || 'Sans titre',
        description: event.description || null,
        location: event.location || null,
        start_at: startAt,
        end_at: endAt,
        all_day: isAllDay,
        color: '#6366f1',
        shared: false,
        reminder_minutes: null
      }
    }).filter(e => e.start_at && e.end_at)
  } catch (err) {
    console.error('Erreur parsing ICS:', err)
    throw new Error('Fichier .ics invalide')
  }
}
