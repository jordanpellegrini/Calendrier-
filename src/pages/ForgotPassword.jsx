import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { resetPassword } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await resetPassword(email)
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Mot de passe oublié</h1>
        <p className="subtitle">On t'envoie un lien de réinitialisation</p>
        {sent ? (
          <div>
            <p className="success">Si cet email existe, un lien a été envoyé.</p>
            <Link to="/login" className="link" style={{ display: 'block', textAlign: 'center', marginTop: '1rem' }}>Retour à la connexion</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>
            <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
              <Link to="/login" className="link">Retour</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
