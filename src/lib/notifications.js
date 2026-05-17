// Notifications locales du navigateur (compatible Android + Chrome PWA)

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported'
  }
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

export function showLocalNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        ...options
      })
    })
  } else {
    new Notification(title, options)
  }
}

// Planificateur de rappels locaux (utilise setTimeout, recharge au démarrage)
const scheduledTimers = new Map()

export function scheduleEventReminder(event) {
  if (!event.reminder_minutes) return
  
  const eventTime = new Date(event.start_at).getTime()
  const reminderTime = eventTime - event.reminder_minutes * 60 * 1000
  const now = Date.now()
  const delay = reminderTime - now
  
  if (delay <= 0 || delay > 24 * 60 * 60 * 1000 * 7) return // ignore si passé ou > 7j
  
  if (scheduledTimers.has(event.id)) {
    clearTimeout(scheduledTimers.get(event.id))
  }
  
  const timerId = setTimeout(() => {
    showLocalNotification('⏰ ' + event.title, {
      body: formatReminderBody(event),
      tag: 'reminder-' + event.id,
      data: { eventId: event.id }
    })
    scheduledTimers.delete(event.id)
  }, delay)
  
  scheduledTimers.set(event.id, timerId)
}

function formatReminderBody(event) {
  const date = new Date(event.start_at)
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  let body = `À ${time}`
  if (event.location) body += ` — ${event.location}`
  return body
}

export function cancelEventReminder(eventId) {
  if (scheduledTimers.has(eventId)) {
    clearTimeout(scheduledTimers.get(eventId))
    scheduledTimers.delete(eventId)
  }
}

export function rescheduleAllReminders(events) {
  // Annule tous les timers existants
  scheduledTimers.forEach(t => clearTimeout(t))
  scheduledTimers.clear()
  // Reprogramme
  events.forEach(scheduleEventReminder)
}
