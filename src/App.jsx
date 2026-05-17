import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { CalendarDays, StickyNote, Bell, Settings as SettingsIcon, Shield } from 'lucide-react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import { showLocalNotification, requestNotificationPermission } from './lib/notifications'

import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Calendar from './pages/Calendar'
import Notes from './pages/Notes'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import NotificationsPanel from './components/NotificationsPanel'

import './styles/global.css'

function MainApp() {
  const { user, profile, loading } = useAuth()
  const [tab, setTab] = useState('calendar')
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
  }

  useEffect(() => {
    if (!user) return
    requestNotificationPermission()
    loadUnread()
    
    const channel = supabase
      .channel('notif-realtime-' + user.id)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          loadUnread()
          const n = payload.new
          showLocalNotification(n.title, { body: n.body, tag: 'notif-' + n.id })
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
        () => loadUnread()
      )
      .subscribe()
    
    return () => supabase.removeChannel(channel)
  }, [user])

  async function loadUnread() {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false)
    setUnreadCount(count || 0)
  }

  if (loading) {
    return <div className="center-spinner" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>
  }

  if (!user) return <Navigate to="/login" replace />

  const titles = {
    calendar: 'Calendrier',
    notes: 'Notes',
    settings: 'Paramètres',
    admin: 'Admin'
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>{titles[tab]}</h1>
        <button className="icon-btn" onClick={() => setShowNotifs(!showNotifs)} aria-label="Notifications">
          <Bell size={20} />
          {unreadCount > 0 && <span className="badge"></span>}
        </button>
      </header>

      {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}

      <div className="app-content">
        {tab === 'calendar' && <Calendar />}
        {tab === 'notes' && <Notes />}
        {tab === 'settings' && <Settings installPrompt={installPrompt} onInstall={handleInstall} />}
        {tab === 'admin' && <Admin />}
      </div>

      <nav className="bottom-nav">
        <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>
          <CalendarDays size={22} />
          <span>Calendrier</span>
        </button>
        <button className={tab === 'notes' ? 'active' : ''} onClick={() => setTab('notes')}>
          <StickyNote size={22} />
          <span>Notes</span>
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          <SettingsIcon size={22} />
          <span>Paramètres</span>
        </button>
        {profile?.is_admin && (
          <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>
            <Shield size={22} />
            <span>Admin</span>
          </button>
        )}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/*" element={<MainApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
