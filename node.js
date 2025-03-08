const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Cargar credenciales de Firebase
const serviceAccount = require('./firebase_credentials.json');

// **Asegurar que Firebase se inicializa antes de usar Firestore**
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();  // Esto ahora funciona correctamente

// Directorio donde se guardará la sesión
const SESSION_DIR = path.join(__dirname, 'chrome_session');

async function loadSessionData() {
  try {
    const doc = await db.collection('wwebjs_auth').doc('vicebot-test').get();
    if (!doc.exists) {
      console.warn("[Auth] No se encontró sesión en Firestore.");
      return false;
    }

    const { sessionData } = doc.data();
    if (!sessionData) {
      console.warn("[Auth] No hay datos de sesión en Firestore.");
      return false;
    }

    // Asegurar que el directorio de sesión existe
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      console.log(`[Session] Directorio creado: ${SESSION_DIR}`);
    }

    // Restaurar los archivos
    for (const [sanitizedFileName, base64Content] of Object.entries(sessionData)) {
      const filePath = path.join(SESSION_DIR, sanitizedFileName);
      fs.writeFileSync(filePath, Buffer.from(base64Content, 'base64'));
      console.log(`[Session] Restaurado el archivo: ${sanitizedFileName}`);
    }

    console.log("[Auth] Sesión restaurada correctamente desde Firestore.");
    return true;
  } catch (error) {
    console.error("[Auth] Error al restaurar la sesión:", error);
    return false;
  }
}

// Ejecutar la restauración de sesión
loadSessionData();

//listo