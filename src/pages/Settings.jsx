import { useState } from 'react'
import { LogOut, Download, Bell, Link2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { COLORS, NOTE_COLORS } from '../lib/dateUtils'
import { requestNotificationPermission } from '../lib/notifications'

export default function Settings({ installPrompt, onInstall }) {
  const { profile, refreshProfile, signOut } = useAuth()
  const [partnerEmail, setPartnerEmail] = useState('')
  const [linkMsg, setLinkMsg] = useState('')
  const [linking, setLinking] = useState(false)
  const [notifStatus, setNotifStatus] = useState(Notification.permission)

  async function updateProfile(updates) {
    await supabase.from('profiles').update(updates).eq('id', profile.id)
    refreshProfile()
  }

  async function handleLinkPartner() {
    if (!partnerEmail.trim()) return
    setLinking(true)
    setLinkMsg('')
    
    const { data: partner } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', partnerEmail.trim().toLowerCase())
      .single()
    
    if (!partner) {
      setLinkMsg('❌ Aucun compte trouvé avec cet email')
      setLinking(false)
      return
    }
    
    if (partner.id === profile.id) {
      setLinkMsg('❌ Tu ne peux pas te lier à toi-même')
      setLinking(false)
      return
    }
    
    // Lier bidirectionnellement
    await supabase.from('profiles').update({ partner_id: partner.id }).eq('id', profile.id)
    await supabase.from('profiles').update({ partner_id: profile.id }).eq('id', partner.id)
    
    setLinkMsg('✅ Lié avec ' + partner.email)
    setPartnerEmail('')
    refreshProfile()
    setLinking(false)
  }

  async function handleUnlinkPartner() {
    if (!confirm('Délier ton partenaire ?')) return
    if (profile.partner_id) {
      await supabase.from('profiles').update({ partner_id: null }).eq('id', profile.partner_id)
    }
    await supabase.from('profiles').update({ partner_id: null }).eq('id', profile.id)
    refreshProfile()
  }

  async function handleEnableNotifs() {
    const result = await requestNotificationPermission()
    setNotifStatus(result)
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Paramètres</h2>

      {installPrompt && (
        <div className="install-banner">
          <div>
            <strong>Installer l'app</strong>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Ajoute Planning à ton écran d'accueil</div>
          </div>
          <button onClick={onInstall}>
            <Download size={16} style={{ verticalAlign: 'middle' }} /> Installer
          </button>
        </div>
      )}

      <div className="settings-section">
        <h3>Compte</h3>
        <div className="settings-row">
          <div className="label">
            <div className="title">{profile?.display_name}</div>
            <div className="desc">{profile?.email}</div>
          </div>
        </div>
        <div className="settings-row">
          <div className="label">
            <div className="title">Partenaire</div>
            <div className="desc">{profile?.partner_id ? 'Lié' : 'Non lié'}</div>
          </div>
        </div>
        {profile?.partner_id ? (
          <button className="btn-secondary" onClick={handleUnlinkPartner} style={{ marginTop: '0.5rem' }}>
            Délier le partenaire
          </button>
        ) : (
          <>
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label>Email du partenaire</label>
              <input
                type="email"
                value={partnerEmail}
                onChange={e => setPartnerEmail(e.target.value)}
                placeholder="ta-femme@example.com"
              />
            </div>
            <button className="btn-primary" onClick={handleLinkPartner} disabled={linking}>
              <Link2 size={16} style={{ verticalAlign: 'middle' }} /> Lier le partenaire
            </button>
            {linkMsg && <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>{linkMsg}</p>}
          </>
        )}
      </div>

      <div className="settings-section">
        <h3>Notifications</h3>
        <div className="settings-row">
          <div className="label">
            <div className="title">Notifications push</div>
            <div className="desc">
              {notifStatus === 'granted' ? '✅ Activées' : notifStatus === 'denied' ? '❌ Bloquées (autorise dans les paramètres du navigateur)' : '⚠️ Non activées'}
            </div>
          </div>
          {notifStatus !== 'granted' && notifStatus !== 'denied' && (
            <button className="btn-primary" onClick={handleEnableNotifs} style={{ width: 'auto', padding: '0.5rem 1rem' }}>
              <Bell size={16} style={{ verticalAlign: 'middle' }} />
            </button>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h3>Affichage du calendrier</h3>
        <div className="settings-row">
          <div className="label">
            <div className="title">La semaine commence le</div>
          </div>
          <select
            value={profile?.week_starts_on ?? 1}
            onChange={e => updateProfile({ week_starts_on: Number(e.target.value) })}
          >
            <option value={0}>Dimanche</option>
            <option value={1}>Lundi</option>
          </select>
        </div>
        <div className="settings-row">
          <div className="label">
            <div className="title">Vue par défaut</div>
          </div>
          <select
            value={profile?.default_view || 'month'}
            onChange={e => updateProfile({ default_view: e.target.value })}
          >
            <option value="month">Mois</option>
            <option value="week">Semaine</option>
            <option value="day">Jour</option>
            <option value="agenda">Liste</option>
          </select>
        </div>
        <div className="settings-row">
          <div className="label">
            <div className="title">Fuseau horaire</div>
            <div className="desc">{profile?.timezone || 'Asia/Qatar'}</div>
          </div>
          <select
            value={profile?.timezone || 'Asia/Qatar'}
            onChange={e => updateProfile({ timezone: e.target.value })}
            style={{ maxWidth: '150px' }}
          >
            <option value="Asia/Qatar">Qatar (UTC+3)</option>
            <option value="Europe/Paris">Paris (UTC+1/+2)</option>
            <option value="Asia/Dubai">Dubai (UTC+4)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3>Couleur par défaut événements</h3>
        <div className="color-picker">
          {COLORS.map(c => (
            <div
              key={c.value}
              className={`color-swatch ${profile?.default_event_color === c.value ? 'selected' : ''}`}
              style={{ background: c.value }}
              onClick={() => updateProfile({ default_event_color: c.value })}
            />
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3>Couleur par défaut notes</h3>
        <div className="color-picker">
          {NOTE_COLORS.map(c => (
            <div
              key={c.value}
              className={`color-swatch ${profile?.default_note_color === c.value ? 'selected' : ''}`}
              style={{ background: c.value, border: c.value === '#ffffff' ? '1px solid #d1d5db' : '2px solid transparent' }}
              onClick={() => updateProfile({ default_note_color: c.value })}
            />
          ))}
        </div>
      </div>

      <button className="btn-danger" onClick={signOut} style={{ width: '100%', marginTop: '1rem' }}>
        <LogOut size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
        Se déconnecter
      </button>
    </div>
  )
}
