import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'

export const COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose', value: '#ec4899' },
  { name: 'Vert', value: '#10b981' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Rouge', value: '#ef4444' },
  { name: 'Bleu', value: '#3b82f6' },
  { name: 'Violet', value: '#a855f7' },
  { name: 'Turquoise', value: '#14b8a6' }
]

export const NOTE_COLORS = [
  { name: 'Jaune', value: '#fef3c7' },
  { name: 'Rose', value: '#fce7f3' },
  { name: 'Bleu', value: '#dbeafe' },
  { name: 'Vert', value: '#d1fae5' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Violet', value: '#e9d5ff' },
  { name: 'Gris', value: '#e5e7eb' },
  { name: 'Blanc', value: '#ffffff' }
]

export const REMINDER_OPTIONS = [
  { label: 'Aucun', value: null },
  { label: 'À l\'heure', value: 0 },
  { label: '5 min avant', value: 5 },
  { label: '15 min avant', value: 15 },
  { label: '30 min avant', value: 30 },
  { label: '1 heure avant', value: 60 },
  { label: '2 heures avant', value: 120 },
  { label: '1 jour avant', value: 1440 },
  { label: '2 jours avant', value: 2880 },
  { label: '1 semaine avant', value: 10080 }
]

export function fmtDate(date, pattern = 'PPP') {
  return format(typeof date === 'string' ? parseISO(date) : date, pattern, { locale: fr })
}

export function fmtTime(date) {
  return format(typeof date === 'string' ? parseISO(date) : date, 'HH:mm')
}

export function buildMonthGrid(currentMonth, weekStartsOn = 1) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn })
  
  const days = []
  let day = gridStart
  while (day <= gridEnd) {
    days.push(day)
    day = addDays(day, 1)
  }
  return days
}

export function getWeekDays(weekStartsOn = 1) {
  const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
  if (weekStartsOn === 1) {
    return [...days.slice(1), days[0]]
  }
  return days
}

export function getWeekDaysLong(weekStartsOn = 1) {
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  if (weekStartsOn === 1) {
    return [...days.slice(1), days[0]]
  }
  return days
}

export { isSameDay, isSameMonth, isToday, addMonths, subMonths, addDays }
