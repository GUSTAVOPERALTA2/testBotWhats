const fs = require('fs');
const path = require('path');
const { getFirestore } = require('firebase-admin/firestore');

// Asumiendo que ya inicializaste Firebase y tienes el directorio SESSION_DIR definido:
const SESSION_DIR = path.join(__dirname, 'chrome_session');
const db = getFirestore();

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

    // Asegurarse de que el directorio de sesión exista
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      console.log(`[Session] Directorio creado: ${SESSION_DIR}`);
    }

    // Iterar sobre cada archivo guardado y restaurarlo
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

// Ejecutar la función para probar la restauración
loadSessionData();

//restauracion