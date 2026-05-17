import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Signup() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (password.length < 6) {
      setError('Mot de passe : 6 caractères minimum')
      return
    }
    setLoading(true)
    const { error } = await signUp(email, password, displayName)
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Compte créé ! Vérifie ta boîte mail pour confirmer.')
      setTimeout(() => navigate('/login'), 3000)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Inscription</h1>
        <p className="subtitle">Crée ton compte</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Prénom</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label>Mot de passe (6 caractères min)</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>
        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
          Déjà inscrit ? <Link to="/login" className="link">Connexion</Link>
        </div>
      </div>
    </div>
  )
}
