// Authentification biométrique via WebAuthn (empreinte / Face Unlock Android)
// Approche : on enregistre une "passkey" liée à l'appareil pour confirmer
// que c'est bien ce téléphone qui déverrouille — la biométrie reste locale.

const STORAGE_KEY = 'biometric_credential_id'
const STORAGE_ENABLED = 'biometric_enabled'

// Convertit ArrayBuffer en base64 et inversement
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i])
  return btoa(str)
}

function base64ToBuffer(base64) {
  const str = atob(base64)
  const buffer = new ArrayBuffer(str.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return buffer
}

export function isBiometricSupported() {
  return typeof window !== 'undefined' 
    && window.PublicKeyCredential 
    && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
}

export async function isBiometricAvailable() {
  if (!isBiometricSupported()) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function isBiometricEnabled() {
  return localStorage.getItem(STORAGE_ENABLED) === 'true' && !!localStorage.getItem(STORAGE_KEY)
}

// Enregistre une passkey liée au compte de l'utilisateur
export async function enableBiometric(userId, userEmail) {
  if (!await isBiometricAvailable()) {
    throw new Error('Biométrie non disponible sur cet appareil')
  }

  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const userIdBuffer = new TextEncoder().encode(userId)

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'Calendrier',
        id: window.location.hostname
      },
      user: {
        id: userIdBuffer,
        name: userEmail,
        displayName: userEmail
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },    // ES256
        { type: 'public-key', alg: -257 }   // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Empreinte/Face du téléphone uniquement
        userVerification: 'required',
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    }
  })

  if (!credential) throw new Error('Enregistrement annulé')

  const credentialId = bufferToBase64(credential.rawId)
  localStorage.setItem(STORAGE_KEY, credentialId)
  localStorage.setItem(STORAGE_ENABLED, 'true')

  return true
}

// Vérifie la biométrie pour déverrouiller
export async function verifyBiometric() {
  const credentialId = localStorage.getItem(STORAGE_KEY)
  if (!credentialId) throw new Error('Aucune empreinte enregistrée')

  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{
        type: 'public-key',
        id: base64ToBuffer(credentialId),
        transports: ['internal']
      }],
      userVerification: 'required',
      timeout: 60000
    }
  })

  return !!assertion
}

// Désactive et oublie la passkey
export function disableBiometric() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(STORAGE_ENABLED)
}
