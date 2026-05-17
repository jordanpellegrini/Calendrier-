import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { COLORS, REMINDER_OPTIONS } from '../lib/dateUtils'

export default function EventModal({ event, onClose, onSaved }) {
  const { user, profile } = useAuth()
  const isNew = !event.id
  // Le partenaire peut modifier les événements partagés
  const canEdit = isNew || event.user_id === user.id || event.shared === true

  const [form, setForm] = useState({
    title: event.title || '',
    description: event.description || '',
    location: event.location || '',
    start_at: toLocalInputValue(event.start_at),
    end_at: toLocalInputValue(event.end_at),
    all_day: event.all_day || false,
    color: event.color || profile?.default_event_color || '#f56565',
    shared: event.shared || false,
    reminder_minutes: event.reminder_minutes ?? null
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toLocalInputValue(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function toLocalDateValue(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  }

  async function handleSave() {
    if (!form.title.trim()) {
      setError('Titre requis')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      all_day: form.all_day,
      color: form.color,
      shared: form.shared,
      reminder_minutes: form.reminder_minutes
    }

    if (isNew) {
      payload.user_id = user.id
      const { error } = await supabase.from('events').insert(payload)
      if (error) setError(error.message)
      else onSaved()
    } else {
      const { error } = await supabase.from('events').update(payload).eq('id', event.id)
      if (error) setError(error.message)
      else onSaved()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Supprimer cet événement ?')) return
    await supabase.from('events').delete().eq('id', event.id)
    onSaved()
  }

  const isOwner = isNew || event.user_id === user.id

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isNew ? 'Nouvel événement' : isOwner ? 'Modifier' : 'Événement partagé'}</h2>
          <button onClick={onClose} className="icon-btn"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Titre *</label>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} disabled={!canEdit} />
          </div>

          <div className="toggle-row">
            <label>Toute la journée</label>
            <label className="toggle">
              <input type="checkbox" checked={form.all_day} onChange={e => setForm({...form, all_day: e.target.checked})} disabled={!canEdit} />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {form.all_day ? (
            <>
              <div className="form-group">
                <label>Date début</label>
                <input type="date" value={toLocalDateValue(form.start_at)} onChange={e => setForm({...form, start_at: e.target.value + 'T00:00'})} disabled={!canEdit} />
              </div>
              <div className="form-group">
                <label>Date fin</label>
                <input type="date" value={toLocalDateValue(form.end_at)} onChange={e => setForm({...form, end_at: e.target.value + 'T23:59'})} disabled={!canEdit} />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Début</label>
                <input type="datetime-local" value={form.start_at} onChange={e => setForm({...form, start_at: e.target.value})} disabled={!canEdit} />
              </div>
              <div className="form-group">
                <label>Fin</label>
                <input type="datetime-local" value={form.end_at} onChange={e => setForm({...form, end_at: e.target.value})} disabled={!canEdit} />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Lieu</label>
            <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} disabled={!canEdit} />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} disabled={!canEdit} />
          </div>

          <div className="form-group">
            <label>Rappel</label>
            <select value={form.reminder_minutes ?? ''} onChange={e => setForm({...form, reminder_minutes: e.target.value === '' ? null : Number(e.target.value)})} disabled={!canEdit}>
              {REMINDER_OPTIONS.map(opt => (
                <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Couleur</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <div
                  key={c.value}
                  className={`color-swatch ${form.color === c.value ? 'selected' : ''}`}
                  style={{ background: c.value }}
                  onClick={() => canEdit && setForm({...form, color: c.value})}
                />
              ))}
            </div>
          </div>

          {/* Le partage ne peut être modifié que par le propriétaire */}
          <div className="toggle-row">
            <label>Partager avec mon partenaire</label>
            <label className="toggle">
              <input type="checkbox" checked={form.shared} onChange={e => setForm({...form, shared: e.target.checked})} disabled={!isOwner} />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {!isOwner && form.shared && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              💡 Cet événement t'a été partagé. Tu peux le modifier et le supprimer.
            </p>
          )}

          {error && <p className="error">{error}</p>}
        </div>
        <div className="modal-footer">
          {!isNew && canEdit && (
            <button className="btn-danger" onClick={handleDelete} style={{ flex: '0 0 auto' }}>
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          {canEdit && (
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '...' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
