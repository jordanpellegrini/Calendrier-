import { useState, useEffect } from 'react'
import { Plus, Users, CheckSquare, Pin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import NoteModal from '../components/NoteModal'

export default function Notes() {
  const { profile } = useAuth()
  const [notes, setNotes] = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    loadNotes()
    
    const channel = supabase
      .channel('notes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => loadNotes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'note_items' }, () => loadNotes())
      .subscribe()
    
    return () => supabase.removeChannel(channel)
  }, [profile])

  async function loadNotes() {
    setLoading(true)
    const { data: notesData } = await supabase
      .from('notes')
      .select('*')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    
    if (notesData) {
      // Charger les items pour les notes type "todo"
      const todoIds = notesData.filter(n => n.type === 'todo').map(n => n.id)
      let itemsByNote = {}
      if (todoIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('note_items')
          .select('*')
          .in('note_id', todoIds)
          .order('position', { ascending: true })
        if (itemsData) {
          itemsData.forEach(item => {
            if (!itemsByNote[item.note_id]) itemsByNote[item.note_id] = []
            itemsByNote[item.note_id].push(item)
          })
        }
      }
      
      setNotes(notesData.map(n => ({ ...n, items: itemsByNote[n.id] || [] })))
    }
    setLoading(false)
  }

  function handleAdd() {
    setEditing({
      title: '',
      content: '',
      type: 'text',
      color: profile?.default_note_color || '#fef3c7',
      shared: false,
      pinned: false,
      items: []
    })
  }

  if (loading) return <div className="center-spinner"><div className="spinner"></div></div>

  return (
    <>
      {notes.length === 0 ? (
        <div className="empty-state">
          <p>Aucune note pour l'instant</p>
          <p style={{ fontSize: '0.85rem' }}>Appuie sur + pour en créer une</p>
        </div>
      ) : (
        <div className="notes-grid">
          {notes.map(note => (
            <div
              key={note.id}
              className="note-card"
              style={{ background: note.color }}
              onClick={() => setEditing(note)}
            >
              <div className="note-icons">
                {note.pinned && <Pin size={12} />}
                {note.shared && <Users size={12} />}
                {note.type === 'todo' && <CheckSquare size={12} />}
              </div>
              <h3>{note.title || 'Sans titre'}</h3>
              {note.type === 'text' ? (
                <p>{note.content}</p>
              ) : (
                <div>
                  {note.items.slice(0, 6).map(it => (
                    <div key={it.id} style={{ fontSize: '0.8rem', display: 'flex', gap: '4px', alignItems: 'center', opacity: it.checked ? 0.5 : 1 }}>
                      <span style={{ fontSize: '0.7rem' }}>{it.checked ? '☑' : '☐'}</span>
                      <span style={{ textDecoration: it.checked ? 'line-through' : 'none' }}>{it.content}</span>
                    </div>
                  ))}
                  {note.items.length > 6 && <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>+ {note.items.length - 6} autres</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <button className="fab" onClick={handleAdd}><Plus size={24} /></button>
      
      {editing && (
        <NoteModal
          note={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { loadNotes(); setEditing(null) }}
        />
      )}
    </>
  )
}
