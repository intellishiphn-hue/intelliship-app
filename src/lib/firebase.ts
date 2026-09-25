import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

// Config leida de variables de entorno (VITE_*), nunca hardcodeada en el
// codigo fuente. Ver .env.example. En local va en .env.local (no se sube
// a git); en GitHub Actions se inyecta como variables/secrets del repo.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app)

// Segunda instancia de la app, solo para que el admin pueda crear cuentas
// nuevas (createUserWithEmailAndPassword) sin que eso cierre su propia
// sesion (el SDK de Firebase inicia sesion automaticamente como el usuario
// recien creado en la instancia donde se llama, por eso se usa una app
// aparte y se cierra su sesion enseguida).
import { getApps, initializeApp as initSecondaryApp } from 'firebase/app'
import { getAuth as getSecondaryAuth } from 'firebase/auth'

const secondaryApp =
  getApps().find((a) => a.name === 'admin-secundaria') ??
  initSecondaryApp(firebaseConfig, 'admin-secundaria')
export const authSecundaria = getSecondaryAuth(secondaryApp)
