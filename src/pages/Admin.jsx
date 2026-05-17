import { useState, useEffect } from 'react'
import { Mail, Shield, Trash2, Link2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Admin() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (profile?.is_admin) loadUsers()
    else setLoading(false)
  }, [profile])

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data) setUsers(data)
    setLoading(false)
  }

  async function handleResetPassword(email) {
    if (!confirm(`Envoyer un email de réinitialisation à ${email} ?`)) return
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password'
    })
    setMsg(error ? '❌ ' + error.message : `✅ Email envoyé à ${email}`)
  }

  async function toggleAdmin(user) {
    if (!confirm(`${user.is_admin ? 'Retirer' : 'Donner'} les droits admin à ${user.email} ?`)) return
    await supabase.from('profiles').update({ is_admin: !user.is_admin }).eq('id', user.id)
    loadUsers()
  }

  async function handleDeleteData(user) {
    if (!confirm(`⚠️ Supprimer TOUTES les données de ${user.email} (événements + notes) ? Le compte sera conservé.`)) return
    await supabase.from('events').delete().eq('user_id', user.id)
    await supabase.from('notes').delete().eq('user_id', user.id)
    setMsg(`✅ Données de ${user.email} supprimées`)
  }

  async function handleUnlink(user) {
    if (!confirm(`Délier ${user.email} de son partenaire ?`)) return
    if (user.partner_id) {
      await supabase.from('profiles').update({ partner_id: null }).eq('id', user.partner_id)
    }
    await supabase.from('profiles').update({ partner_id: null }).eq('id', user.id)
    loadUsers()
  }

  if (loading) return <div className="center-spinner"><div className="spinner"></div></div>

  if (!profile?.is_admin) {
    return (
      <div className="empty-state">
        <Shield size={48} style={{ margin: '0 auto 1rem' }} />
        <p>Accès refusé — réservé aux admins</p>
        <p style={{ fontSize: '0.85rem' }}>Pour devenir admin, va dans le SQL Editor de Supabase et exécute :</p>
        <code style={{ fontSize: '0.8rem', background: 'white', padding: '0.5rem', borderRadius: '4px', display: 'inline-block', marginTop: '0.5rem' }}>
          UPDATE profiles SET is_admin = TRUE WHERE email = 'ton@email.com';
        </code>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}><Shield size={20} style={{ verticalAlign: 'middle' }} /> Administration</h2>
      
      {msg && <div style={{ padding: '0.75rem', background: '#eef2ff', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>{msg}</div>}

      <div className="settings-section">
        <h3>Utilisateurs ({users.length})</h3>
        {users.map(u => (
          <div key={u.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {u.display_name || u.email.split('@')[0]}
                  {u.is_admin && <Shield size={14} style={{ color: 'var(--primary)' }} />}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{u.email}</div>
                {u.partner_id && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Lié à : {users.find(x => x.id === u.partner_id)?.email || u.partner_id}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => handleResetPassword(u.email)} className="btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', minWidth: '120px' }}>
                <Mail size={14} style={{ verticalAlign: 'middle' }} /> Reset MDP
              </button>
              <button onClick={() => toggleAdmin(u)} className="btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', minWidth: '100px' }}>
                {u.is_admin ? 'Retirer admin' : 'Faire admin'}
              </button>
              {u.partner_id && (
                <button onClick={() => handleUnlink(u)} className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                  <Link2 size={14} />
                </button>
              )}
              <button onClick={() => handleDeleteData(u)} className="btn-danger" style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
