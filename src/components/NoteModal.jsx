import { useState } from 'react'
import { X, Trash2, Plus, Pin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { NOTE_COLORS } from '../lib/dateUtils'

export default function NoteModal({ note, onClose, onSaved }) {
  const { user, profile } = useAuth()
  const isNew = !note.id
  const isOwner = isNew || note.user_id === user.id
  // Le partenaire peut modifier les notes partagées
  const canEdit = isNew || isOwner || note.shared === true

  const [form, setForm] = useState({
    title: note.title || '',
    content: note.content || '',
    type: note.type || 'text',
    color: note.color || profile?.default_note_color || '#fef3c7',
    shared: note.shared || false,
    pinned: note.pinned || false
  })
  const [items, setItems] = useState(note.items || [])
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!form.title.trim() && !form.content.trim() && items.length === 0) {
      setError('Note vide')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      title: form.title.trim() || 'Sans titre',
      content: form.type === 'text' ? form.content : null,
      type: form.type,
      color: form.color,
      // Le partage et l'épinglage ne sont modifiables que par le propriétaire
      ...(isOwner ? { shared: form.shared, pinned: form.pinned } : {})
    }

    let noteId = note.id
    if (isNew) {
      payload.user_id = user.id
      payload.shared = form.shared
      payload.pinned = form.pinned
      const { data, error } = await supabase.from('notes').insert(payload).select().single()
      if (error) { setError(error.message); setSaving(false); return }
      noteId = data.id
    } else {
      const { error } = await supabase.from('notes').update(payload).eq('id', note.id)
      if (error) { setError(error.message); setSaving(false); return }
    }

    if (form.type === 'todo' && noteId) {
      await supabase.from('note_items').delete().eq('note_id', noteId)
      if (items.length > 0) {
        const toInsert = items.map((it, i) => ({
          note_id: noteId,
          content: it.content,
          checked: it.checked || false,
          position: i
        }))
        await supabase.from('note_items').insert(toInsert)
      }
    }

    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    if (!confirm('Supprimer cette note ?')) return
    await supabase.from('notes').delete().eq('id', note.id)
    onSaved()
  }

  function addItem() {
    if (!newItem.trim()) return
    setItems([...items, { id: 'tmp-' + Date.now(), content: newItem.trim(), checked: false }])
    setNewItem('')
  }

  function toggleItem(idx) {
    const next = [...items]
    next[idx] = { ...next[idx], checked: !next[idx].checked }
    setItems(next)
  }

  function removeItem(idx) {
    setItems(items.filter((_, i) => i !== idx))
  }

  function updateItemContent(idx, content) {
    const next = [...items]
    next[idx] = { ...next[idx], content }
    setItems(next)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ background: form.color }}>
        <div className="modal-header" style={{ background: form.color, borderBottomColor: 'rgba(0,0,0,0.1)' }}>
          <h2>{isNew ? 'Nouvelle note' : isOwner ? 'Note' : 'Note partagée'}</h2>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {isOwner && (
              <button onClick={() => setForm({...form, pinned: !form.pinned})} className="icon-btn" title="Épingler">
                <Pin size={18} style={{ fill: form.pinned ? 'currentColor' : 'none' }} />
              </button>
            )}
            <button onClick={onClose} className="icon-btn"><X size={20} /></button>
          </div>
        </div>
        <div className="modal-body" style={{ background: form.color }}>
          <input
            placeholder="Titre"
            value={form.title}
            onChange={e => setForm({...form, title: e.target.value})}
            disabled={!canEdit}
            style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '1.1rem', fontWeight: 700, padding: '0.5rem 0', outline: 'none' }}
          />

          {canEdit && (
            <div className="view-switcher" style={{ marginTop: '0.5rem' }}>
              <button className={form.type === 'text' ? 'active' : ''} onClick={() => setForm({...form, type: 'text'})}>Texte</button>
              <button className={form.type === 'todo' ? 'active' : ''} onClick={() => setForm({...form, type: 'todo'})}>Liste</button>
            </div>
          )}

          {form.type === 'text' ? (
            <textarea
              placeholder="Contenu..."
              value={form.content}
              onChange={e => setForm({...form, content: e.target.value})}
              disabled={!canEdit}
              rows={8}
              style={{ width: '100%', border: 'none', background: 'transparent', resize: 'vertical', outline: 'none', fontSize: '0.95rem', padding: '0.5rem 0' }}
            />
          ) : (
            <div style={{ marginTop: '0.5rem' }}>
              {items.map((it, idx) => (
                <div key={it.id || idx} className={`todo-item ${it.checked ? 'checked' : ''}`}>
                  <input type="checkbox" checked={it.checked || false} onChange={() => toggleItem(idx)} />
                  {canEdit ? (
                    <input
                      value={it.content}
                      onChange={e => updateItemContent(idx, e.target.value)}
                      className="todo-text"
                      style={{ border: 'none', background: 'transparent', outline: 'none', textDecoration: it.checked ? 'line-through' : 'none', opacity: it.checked ? 0.5 : 1 }}
                    />
                  ) : (
                    <span className="todo-text">{it.content}</span>
                  )}
                  {canEdit && (
                    <button onClick={() => removeItem(idx)} style={{ color: 'rgba(0,0,0,0.4)' }}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              {canEdit && (
                <div className="todo-add">
                  <input
                    placeholder="Ajouter un élément..."
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
                    style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: '6px', padding: '0.5rem' }}
                  />
                  <button onClick={addItem}><Plus size={18} /></button>
                </div>
              )}
            </div>
          )}

          {canEdit && (
            <div style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Couleur</label>
              <div className="color-picker" style={{ marginTop: '0.5rem' }}>
                {NOTE_COLORS.map(c => (
                  <div
                    key={c.value}
                    className={`color-swatch ${form.color === c.value ? 'selected' : ''}`}
                    style={{ background: c.value, border: c.value === '#ffffff' ? '1px solid #d1d5db' : '2px solid transparent' }}
                    onClick={() => setForm({...form, color: c.value})}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Toggle partage : modifiable uniquement par le créateur */}
          <div className="toggle-row" style={{ marginTop: '0.5rem' }}>
            <label>Partager avec mon partenaire</label>
            <label className="toggle">
              <input type="checkbox" checked={form.shared} onChange={e => setForm({...form, shared: e.target.checked})} disabled={!isOwner} />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {!isOwner && form.shared && (
            <p style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', marginTop: '0.5rem' }}>
              💡 Note partagée par ton partenaire. Tu peux la modifier et la supprimer.
            </p>
          )}

          {error && <p className="error">{error}</p>}
        </div>
        <div className="modal-footer" style={{ background: form.color, borderTopColor: 'rgba(0,0,0,0.1)' }}>
          {!isNew && canEdit && (
            <button className="btn-danger" onClick={handleDelete} style={{ flex: '0 0 auto' }}>
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>Fermer</button>
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
