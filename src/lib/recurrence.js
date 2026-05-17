// Génère les occurrences d'un événement récurrent dans une plage de dates
// Format de recurrence_rule :
// {
//   freq: 'daily' | 'weekly' | 'monthly' | 'yearly',
//   interval: 1, // tous les X
//   days: [1,3,5], // jours de la semaine (0=dim, 1=lun, ...) pour weekly
//   monthDay: 'date' | 'weekday', // pour monthly : par date ou par jour de semaine
//   end: { type: 'never' | 'until' | 'count', until: '2026-12-31', count: 10 }
// }

const MAX_OCCURRENCES = 500 // sécurité

export function expandRecurrence(event, rangeStart, rangeEnd) {
  if (!event.recurrence_rule) return [event]
  
  const rule = event.recurrence_rule
  const occurrences = []
  const baseStart = new Date(event.start_at)
  const baseEnd = new Date(event.end_at)
  const duration = baseEnd - baseStart
  
  const exceptions = new Set((event.exception_dates || []).map(d => d.substring(0, 10)))
  
  const interval = rule.interval || 1
  let count = 0
  let occCount = 0
  const maxCount = rule.end?.type === 'count' ? rule.end.count : MAX_OCCURRENCES
  const untilDate = rule.end?.type === 'until' ? new Date(rule.end.until + 'T23:59:59') : null
  
  let current = new Date(baseStart)
  
  while (occCount < maxCount && count < MAX_OCCURRENCES) {
    count++
    
    // Vérifier qu'on est bien dans la plage de recherche
    if (current > rangeEnd) break
    if (untilDate && current > untilDate) break
    
    if (current >= rangeStart || current.toDateString() === rangeStart.toDateString()) {
      // Inclure cette occurrence sauf si elle est exclue
      const dateKey = current.toISOString().substring(0, 10)
      if (!exceptions.has(dateKey)) {
        const occStart = new Date(current)
        const occEnd = new Date(current.getTime() + duration)
        
        occurrences.push({
          ...event,
          // Marqueur pour reconnaître que c'est une occurrence virtuelle
          _virtualOccurrence: true,
          _originalId: event.id,
          // ID composé pour les keys React
          id: `${event.id}__${dateKey}`,
          start_at: occStart.toISOString(),
          end_at: occEnd.toISOString(),
          occurrence_date: dateKey
        })
      }
    }
    
    occCount = occurrences.length
    
    // Passer à la prochaine occurrence
    current = nextOccurrence(current, baseStart, rule)
    if (!current) break
  }
  
  return occurrences
}

function nextOccurrence(current, baseStart, rule) {
  const next = new Date(current)
  const interval = rule.interval || 1
  
  switch (rule.freq) {
    case 'daily':
      next.setDate(next.getDate() + interval)
      return next
      
    case 'weekly': {
      // Si on a des jours précis (ex: lun, mer, ven)
      if (rule.days && rule.days.length > 0) {
        // Trier les jours
        const sortedDays = [...rule.days].sort((a, b) => a - b)
        const currentDay = next.getDay()
        
        // Trouver le prochain jour dans la semaine actuelle
        const nextDayInWeek = sortedDays.find(d => d > currentDay)
        if (nextDayInWeek !== undefined) {
          next.setDate(next.getDate() + (nextDayInWeek - currentDay))
        } else {
          // Sauter à la première occurrence de la prochaine "période"
          const daysUntilNextWeek = 7 - currentDay + sortedDays[0]
          next.setDate(next.getDate() + daysUntilNextWeek + 7 * (interval - 1))
        }
        return next
      } else {
        // Sinon, simple +X semaines
        next.setDate(next.getDate() + 7 * interval)
        return next
      }
    }
      
    case 'monthly': {
      if (rule.monthDay === 'weekday') {
        // Ex: le 3ème mardi du mois
        const dayOfWeek = baseStart.getDay()
        const weekOfMonth = Math.ceil(baseStart.getDate() / 7)
        
        next.setMonth(next.getMonth() + interval)
        next.setDate(1)
        
        // Trouver le 1er jour de la semaine correspondant
        while (next.getDay() !== dayOfWeek) {
          next.setDate(next.getDate() + 1)
        }
        // Avancer de N semaines
        next.setDate(next.getDate() + 7 * (weekOfMonth - 1))
        return next
      } else {
        // Par date : même jour du mois
        next.setMonth(next.getMonth() + interval)
        return next
      }
    }
      
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval)
      return next
      
    default:
      return null
  }
}

// Description lisible d'une règle (pour afficher dans l'UI)
export function describeRecurrence(rule) {
  if (!rule) return 'Ne se répète pas'
  
  const interval = rule.interval || 1
  const daysFr = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
  
  let desc = ''
  switch (rule.freq) {
    case 'daily':
      desc = interval === 1 ? 'Tous les jours' : `Tous les ${interval} jours`
      break
    case 'weekly':
      if (rule.days && rule.days.length > 0) {
        const dayNames = rule.days.map(d => daysFr[d]).join(', ')
        desc = interval === 1 ? `Chaque semaine le ${dayNames}` : `Toutes les ${interval} semaines le ${dayNames}`
      } else {
        desc = interval === 1 ? 'Chaque semaine' : `Toutes les ${interval} semaines`
      }
      break
    case 'monthly':
      desc = interval === 1 ? 'Chaque mois' : `Tous les ${interval} mois`
      break
    case 'yearly':
      desc = interval === 1 ? 'Chaque année' : `Tous les ${interval} ans`
      break
    default:
      desc = 'Ne se répète pas'
  }
  
  if (rule.end?.type === 'until') {
    desc += `, jusqu'au ${new Date(rule.end.until).toLocaleDateString('fr-FR')}`
  } else if (rule.end?.type === 'count') {
    desc += `, ${rule.end.count} fois`
  }
  
  return desc
}

// Presets pour le menu rapide
export const RECURRENCE_PRESETS = [
  { label: 'Ne se répète pas', value: null },
  { label: 'Tous les jours', value: { freq: 'daily', interval: 1, end: { type: 'never' } } },
  { label: 'Chaque semaine', value: { freq: 'weekly', interval: 1, end: { type: 'never' } } },
  { label: 'Chaque mois', value: { freq: 'monthly', interval: 1, monthDay: 'date', end: { type: 'never' } } },
  { label: 'Chaque année', value: { freq: 'yearly', interval: 1, end: { type: 'never' } } }
]
