import { useState, useEffect } from 'react'
import { Fingerprint, Lock } from 'lucide-react'
import { verifyBiometric, disableBiometric } from '../lib/biometric'
import { useAuth } from '../hooks/useAuth'

export default function BiometricLock({ onUnlock }) {
  const { signOut } = useAuth()
  const [error, setError] = useState('')
  const [trying, setTrying] = useState(false)

  async function tryUnlock() {
    setTrying(true)
    setError('')
    try {
      const ok = await verifyBiometric()
      if (ok) onUnlock()
      else setError('Vérification échouée')
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Vérification annulée')
      } else {
        setError(err.message || 'Erreur biométrique')
      }
    }
    setTrying(false)
  }

  // Tentative auto au chargement
  useEffect(() => {
    tryUnlock()
  }, [])

  async function handleLogout() {
    disableBiometric()
    await signOut()
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 50%, #feebc8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      padding: '2rem',
      zIndex: 999
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '28px',
        padding: '2.5rem 2rem',
        textAlign: 'center',
        maxWidth: '380px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(245, 101, 101, 0.25)'
      }}>
        <div style={{
          width: '88px',
          height: '88px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f56565 0%, #ed8936 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          boxShadow: '0 8px 24px rgba(245, 101, 101, 0.4)'
        }}>
          <Fingerprint size={48} color="white" />
        </div>

        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 700 }}>
          Déverrouillage
        </h2>
        <p style={{ color: '#a0aec0', margin: '0 0 2rem', fontSize: '0.95rem' }}>
          Utilise ton empreinte ou ton visage pour accéder à ton calendrier
        </p>

        {error && (
          <div style={{
            background: '#fff5f5',
            border: '1px solid #fed7d7',
            color: '#c53030',
            padding: '0.75rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <button
          onClick={tryUnlock}
          disabled={trying}
          className="btn-primary"
          style={{ marginBottom: '0.75rem' }}
        >
          {trying ? 'Vérification...' : (
            <>
              <Fingerprint size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Déverrouiller
            </>
          )}
        </button>

        <button
          onClick={handleLogout}
          style={{
            color: '#a0aec0',
            fontSize: '0.85rem',
            padding: '0.5rem',
            width: '100%'
          }}
        >
          <Lock size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
          Utiliser mon mot de passe
        </button>
      </div>
    </div>
  )
}
