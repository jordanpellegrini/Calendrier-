import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Upload, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { 
  buildMonthGrid, getWeekDays, fmtDate, fmtTime,
  isSameMonth, isToday, addMonths, subMonths, addDays
} from '../lib/dateUtils'
import EventModal from '../components/EventModal'
import ImportICSModal from '../components/ImportICSModal'
import { rescheduleAllReminders } from '../lib/notifications'

export default function Calendar() {
  const { user, profile } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState(profile?.default_view || 'month')
  const [events, setEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [loading, setLoading] = useState(true)
  // Map userId -> { signature_color, display_name } pour distinguer les créateurs
  const [userColors, setUserColors] = useState({})

  const weekStartsOn = profile?.week_starts_on ?? 1

  useEffect(() => {
    if (!profile) return
    loadEvents()
    loadUserColors()
    
    const channel = supabase
      .channel('events-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        loadEvents()
      })
      .subscribe()
    
    return () => supabase.removeChannel(channel)
  }, [profile])

  async function loadUserColors() {
    // Charge la couleur signature de l'utilisateur + son partenaire
    const ids = [profile.id]
    if (profile.partner_id) ids.push(profile.partner_id)
    
    const { data } = await supabase
      .from('profiles')
      .select('id, signature_color, display_name')
      .in('id', ids)
    
    if (data) {
      const map = {}
      data.forEach(p => {
        map[p.id] = { 
          color: p.signature_color || '#f56565', 
          name: p.display_name || 'Utilisateur'
        }
      })
      setUserColors(map)
    }
  }

  async function loadEvents() {
    setLoading(true)
    const pageSize = 1000
    let all = []
    let from = 0
    let keepGoing = true
    
    while (keepGoing) {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_at', { ascending: true })
        .range(from, from + pageSize - 1)
      
      if (error) {
        console.error('Erreur chargement events:', error)
        break
      }
      
      if (data && data.length > 0) {
        all = all.concat(data)
        if (data.length < pageSize) keepGoing = false
        else from += pageSize
      } else {
        keepGoing = false
      }
      
      if (from > 20000) keepGoing = false
    }
    
    setEvents(all)
    rescheduleAllReminders(all.filter(e => e.user_id === profile.id && e.reminder_minutes !== null))
    setLoading(false)
  }

  // Renvoie la couleur signature du créateur de l'event (bordure)
  function getCreatorColor(event) {
    return userColors[event.user_id]?.color || '#f56565'
  }

  const monthGrid = useMemo(() => buildMonthGrid(currentDate, weekStartsOn), [currentDate, weekStartsOn])

  function getEventsForDay(day) {
    return events.filter(e => {
      const start = new Date(e.start_at)
      const end = new Date(e.end_at)
      return day >= new Date(start.toDateString()) && day <= new Date(end.toDateString())
    })
  }

  function handleDayClick(day) {
    if (view === 'month') {
      setSelectedDate(day)
      setView('day')
    } else {
      setSelectedDate(day)
      setEditingEvent({ start_at: day.toISOString(), end_at: day.toISOString(), all_day: false, shared: false, color: profile?.default_event_color || '#f56565' })
    }
  }

  function handleAddEvent() {
    const base = selectedDate || new Date()
    const start = new Date(base)
    start.setHours(new Date().getHours() + 1, 0, 0, 0)
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    setEditingEvent({
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      all_day: false,
      shared: false,
      color: profile?.default_event_color || '#f56565'
    })
  }

  if (loading) return <div className="center-spinner"><div className="spinner"></div></div>

  // Légende des couleurs créateurs (visible uniquement si partenaire lié)
  const showLegend = profile?.partner_id && Object.keys(userColors).length >= 2

  return (
    <>
      <div className="view-switcher">
        <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>Mois</button>
        <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Semaine</button>
        <button className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>Jour</button>
        <button className={view === 'agenda' ? 'active' : ''} onClick={() => setView('agenda')}>Liste</button>
      </div>

      {showLegend && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>Créé par :</span>
          {Object.entries(userColors).map(([uid, info]) => (
            <span key={uid} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: info.color, border: `2px solid ${info.color}` }} />
              {uid === user.id ? 'Moi' : info.name}
            </span>
          ))}
        </div>
      )}

      {view === 'month' && (
        <MonthView
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          monthGrid={monthGrid}
          weekStartsOn={weekStartsOn}
          getEventsForDay={getEventsForDay}
          onDayClick={handleDayClick}
          getCreatorColor={getCreatorColor}
        />
      )}
      {view === 'week' && (
        <WeekView
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          weekStartsOn={weekStartsOn}
          getEventsForDay={getEventsForDay}
          onEventClick={setEditingEvent}
          onDayClick={handleDayClick}
          getCreatorColor={getCreatorColor}
        />
      )}
      {view === 'day' && (
        <DayView
          currentDate={selectedDate || currentDate}
          setCurrentDate={d => { setSelectedDate(d); setCurrentDate(d) }}
          events={getEventsForDay(selectedDate || currentDate)}
          onEventClick={setEditingEvent}
          getCreatorColor={getCreatorColor}
        />
      )}
      {view === 'agenda' && (
        <AgendaView events={events} onEventClick={setEditingEvent} getCreatorColor={getCreatorColor} />
      )}

      <button className="fab" onClick={handleAddEvent} aria-label="Ajouter">
        <Plus size={24} />
      </button>

      <button 
        onClick={() => setShowImport(true)}
        style={{ position: 'fixed', bottom: 'calc(85px + var(--safe-bottom))', left: '1.25rem', width: '52px', height: '52px', borderRadius: '50%', background: 'white', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(245, 101, 101, 0.15)', zIndex: 15, color: 'var(--primary)' }}
        aria-label="Importer"
      >
        <Upload size={20} />
      </button>

      {editingEvent && (
        <EventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={() => { loadEvents(); setEditingEvent(null) }}
        />
      )}
      {showImport && (
        <ImportICSModal
          onClose={() => setShowImport(false)}
          onImported={() => { loadEvents(); setShowImport(false) }}
        />
      )}
    </>
  )
}

function MonthView({ currentDate, setCurrentDate, monthGrid, weekStartsOn, getEventsForDay, onDayClick, getCreatorColor }) {
  const dayNames = getWeekDays(weekStartsOn)
  return (
    <>
      <div className="calendar-header">
        <h2>{fmtDate(currentDate, 'MMMM yyyy')}</h2>
        <div className="calendar-nav">
          <button onClick={() => setCurrentDate(new Date())} style={{ width: 'auto', padding: '0 0.75rem', fontSize: '0.85rem' }}>Aujourd'hui</button>
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft size={20} /></button>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight size={20} /></button>
        </div>
      </div>
      <div className="month-grid">
        {dayNames.map((d, i) => <div key={i} className="day-name">{d}</div>)}
        {monthGrid.map((day, i) => {
          const dayEvents = getEventsForDay(day)
          const isOtherMonth = !isSameMonth(day, currentDate)
          return (
            <div
              key={i}
              className={`day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday(day) ? 'today' : ''}`}
              onClick={() => onDayClick(day)}
            >
              <span className="day-number">{day.getDate()}</span>
              {dayEvents.slice(0, 3).map(e => {
                const creatorColor = getCreatorColor(e)
                return (
                  <div 
                    key={e.id} 
                    className="event-pill" 
                    style={{ 
                      background: e.color, 
                      border: `1.5px solid ${creatorColor}`,
                      boxShadow: `inset 0 0 0 1px white`
                    }}
                  >
                    {e.shared && <Users size={8} />}
                    {e.title}
                  </div>
                )
              })}
              {dayEvents.length > 3 && (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>+{dayEvents.length - 3}</span>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function WeekView({ currentDate, setCurrentDate, weekStartsOn, getEventsForDay, onEventClick, onDayClick, getCreatorColor }) {
  const start = new Date(currentDate)
  const day = start.getDay()
  const diff = weekStartsOn === 1 ? (day === 0 ? -6 : 1 - day) : -day
  start.setDate(start.getDate() + diff)
  start.setHours(0,0,0,0)
  
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  
  return (
    <>
      <div className="calendar-header">
        <h2>Semaine du {fmtDate(start, 'd MMM')}</h2>
        <div className="calendar-nav">
          <button onClick={() => setCurrentDate(new Date())} style={{ width: 'auto', padding: '0 0.75rem', fontSize: '0.85rem' }}>Auj.</button>
          <button onClick={() => setCurrentDate(addDays(currentDate, -7))}><ChevronLeft size={20} /></button>
          <button onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight size={20} /></button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {weekDays.map(d => {
          const dayEvents = getEventsForDay(d)
          return (
            <div key={d.toISOString()} className="day-view" style={{ cursor: 'pointer' }} onClick={() => onDayClick(d)}>
              <div className="day-view-header" style={{ background: isToday(d) ? 'var(--gradient)' : '#f9fafb', color: isToday(d) ? 'white' : 'var(--text)' }}>
                {fmtDate(d, 'EEEE d MMMM')}
              </div>
              <div className="day-events">
                {dayEvents.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, padding: '0.5rem' }}>Aucun événement</p>
                ) : (
                  dayEvents.map(e => {
                    const creatorColor = getCreatorColor(e)
                    return (
                      <div 
                        key={e.id} 
                        className="event-item" 
                        style={{ 
                          borderLeftColor: e.color,
                          border: `2px solid ${creatorColor}`,
                          borderLeft: `4px solid ${e.color}`
                        }} 
                        onClick={(ev) => { ev.stopPropagation(); onEventClick(e) }}
                      >
                        <div className="event-time">{e.all_day ? 'Journée' : fmtTime(e.start_at)}</div>
                        <div className="event-title">{e.title}</div>
                        {e.shared && <Users size={14} className="shared-icon" />}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function DayView({ currentDate, setCurrentDate, events, onEventClick, getCreatorColor }) {
  return (
    <>
      <div className="calendar-header">
        <h2>{fmtDate(currentDate, 'EEEE d MMMM')}</h2>
        <div className="calendar-nav">
          <button onClick={() => setCurrentDate(new Date())} style={{ width: 'auto', padding: '0 0.75rem', fontSize: '0.85rem' }}>Auj.</button>
          <button onClick={() => setCurrentDate(addDays(currentDate, -1))}><ChevronLeft size={20} /></button>
          <button onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight size={20} /></button>
        </div>
      </div>
      <div className="day-view">
        <div className="day-events" style={{ maxHeight: 'none' }}>
          {events.length === 0 ? (
            <div className="empty-state">Aucun événement ce jour</div>
          ) : (
            events.map(e => {
              const creatorColor = getCreatorColor(e)
              return (
                <div 
                  key={e.id} 
                  className="event-item" 
                  style={{ 
                    border: `2px solid ${creatorColor}`,
                    borderLeft: `4px solid ${e.color}`
                  }} 
                  onClick={() => onEventClick(e)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="event-title">{e.title}</span>
                      {e.shared && <Users size={14} className="shared-icon" />}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {e.all_day ? 'Toute la journée' : `${fmtTime(e.start_at)} - ${fmtTime(e.end_at)}`}
                      {e.location && ` · ${e.location}`}
                    </div>
                    {e.description && (
                      <div style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text)' }}>{e.description}</div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}

function AgendaView({ events, onEventClick, getCreatorColor }) {
  const now = new Date()
  const upcoming = events.filter(e => new Date(e.end_at) >= now).slice(0, 200)
  
  const grouped = {}
  upcoming.forEach(e => {
    const day = fmtDate(e.start_at, 'EEEE d MMMM yyyy')
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(e)
  })
  
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Liste des événements</h2>
      {Object.keys(grouped).length === 0 ? (
        <div className="empty-state">Aucun événement à venir</div>
      ) : (
        Object.entries(grouped).map(([day, evs]) => (
          <div key={day} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ textTransform: 'capitalize', fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>{day}</h3>
            <div className="day-view">
              <div className="day-events" style={{ maxHeight: 'none' }}>
                {evs.map(e => {
                  const creatorColor = getCreatorColor(e)
                  return (
                    <div 
                      key={e.id} 
                      className="event-item" 
                      style={{ 
                        border: `2px solid ${creatorColor}`,
                        borderLeft: `4px solid ${e.color}`
                      }} 
                      onClick={() => onEventClick(e)}
                    >
                      <div className="event-time">{e.all_day ? 'Journée' : fmtTime(e.start_at)}</div>
                      <div className="event-title">{e.title}</div>
                      {e.shared && <Users size={14} className="shared-icon" />}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
