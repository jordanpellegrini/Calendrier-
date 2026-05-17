import { useEffect, useState } from 'react'
import { CalendarDays, StickyNote, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function NotificationsPanel({ onClose }) {
  const { user } = useAuth()
  const [notifs, setNotifs] = useState([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setNotifs(data)
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    load()
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('recipient_id', user.id).eq('read', false)
    load()
  }

  function fmtRelative(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 60) return 'à l\'instant'
    if (diff < 3600) return `il y a ${Math.floor(diff/60)} min`
    if (diff < 86400) return `il y a ${Math.floor(diff/3600)} h`
    if (diff < 86400 * 7) return `il y a ${Math.floor(diff/86400)} j`
    return new Date(iso).toLocaleDateString('fr-FR')
  }

  return (
    <div className="notif-panel">
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Notifications</strong>
        {notifs.some(n => !n.read) && (
          <button onClick={markAllRead} style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>
            <Check size={14} style={{ verticalAlign: 'middle' }} /> Tout lire
          </button>
        )}
      </div>
      {notifs.length === 0 ? (
        <div className="empty-state">Aucune notification</div>
      ) : (
        notifs.map(n => (
          <div key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`} onClick={() => { markRead(n.id); onClose() }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              {n.type.startsWith('event') ? <CalendarDays size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} /> : <StickyNote size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="notif-title">{n.title}</div>
                {n.body && <div className="notif-body">{n.body}</div>}
                <div className="notif-time">{fmtRelative(n.created_at)}</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
