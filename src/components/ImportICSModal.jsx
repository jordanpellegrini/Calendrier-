import { useState } from 'react'
import { X, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { parseICS } from '../lib/icsParser'

export default function ImportICSModal({ onClose, onImported }) {
  const { user, profile } = useAuth()
  const [parsed, setParsed] = useState(null)
  const [shared, setShared] = useState(false)
  const [color, setColor] = useState(profile?.default_event_color || '#6366f1')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    
    setError('')
    try {
      const text = await file.text()
      const events = parseICS(text)
      setParsed(events)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleImport() {
    if (!parsed) return
    setImporting(true)
    
    // Import par lots de 100
    const events = parsed.map(e => ({
      ...e,
      user_id: user.id,
      shared,
      color
    }))
    
    const batchSize = 100
    let imported = 0
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize)
      const { error } = await supabase.from('events').insert(batch)
      if (error) {
        setError('Erreur à l\'import : ' + error.message)
        setImporting(false)
        return
      }
      imported += batch.length
      setProgress(Math.round((imported / events.length) * 100))
    }
    
    setImporting(false)
    onImported()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Importer un calendrier (.ics)</h2>
          <button onClick={onClose} className="icon-btn"><X size={20} /></button>
        </div>
        <div className="modal-body">
          {!parsed ? (
            <>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Sélectionne un fichier .ics exporté depuis Google Calendar, Samsung Calendar, Apple Calendar, etc.
              </p>
              <label style={{ display: 'block', border: '2px dashed var(--border)', padding: '2rem', borderRadius: '12px', textAlign: 'center', cursor: 'pointer' }}>
                <Upload size={32} style={{ margin: '0 auto 0.5rem', color: 'var(--primary)' }} />
                <div>Cliquer pour sélectionner</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Fichiers .ics uniquement</div>
                <input type="file" accept=".ics,text/calendar" onChange={handleFile} style={{ display: 'none' }} />
              </label>
            </>
          ) : (
            <>
              <p><strong>{parsed.length} événements</strong> trouvés dans le fichier.</p>
              
              <div className="form-group">
                <label>Couleur par défaut</label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '60px', height: '40px', padding: '2px', cursor: 'pointer' }} />
              </div>
              
              <div className="toggle-row">
                <label>Partager tous ces événements avec mon partenaire</label>
                <label className="toggle">
                  <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <details style={{ marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Aperçu des 5 premiers événements
                </summary>
                <ul style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  {parsed.slice(0, 5).map((e, i) => (
                    <li key={i}>{e.title} — {new Date(e.start_at).toLocaleDateString('fr-FR')}</li>
                  ))}
                </ul>
              </details>

              {importing && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden', height: '8px' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s' }} />
                  </div>
                  <p style={{ fontSize: '0.85rem', textAlign: 'center', marginTop: '0.5rem' }}>{progress}%</p>
                </div>
              )}
            </>
          )}
          {error && <p className="error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          {parsed && (
            <button className="btn-primary" onClick={handleImport} disabled={importing}>
              {importing ? `Import... ${progress}%` : `Importer ${parsed.length} événements`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
