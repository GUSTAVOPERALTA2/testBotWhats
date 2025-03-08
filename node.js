const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// Cargar credenciales de Firebase
const serviceAccount = require('./firebase_credentials.json');

// Inicializar Firebase
initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

// Directorio de sesión y archivos a ignorar o excluir
const SESSION_DIR = path.join(__dirname, 'chrome_session');
// Archivos que ya estaban definidos para ignorar
const IGNORED_FILES = ['SingletonCookie', 'SingletonLock'];
// Archivos que se desea excluir por ser demasiado grandes o no esenciales
const EXCLUDED_FILES = ['BrowserMetrics-spare.pma', 'first_party_sets.db', 'first_party_sets.db-journal'];

async function saveSessionData() {
  try {
    // Filtramos: solo se procesan archivos que no estén en IGNORED_FILES ni en EXCLUDED_FILES
    const sessionFiles = fs.readdirSync(SESSION_DIR)
      .filter(file => 
        !IGNORED_FILES.includes(file) && 
        !EXCLUDED_FILES.includes(file) && 
        fs.statSync(path.join(SESSION_DIR, file)).isFile()
      );

    const sessionData = {};
    let totalSize = 0;

    for (const file of sessionFiles) {
      // Sanitizamos el nombre del archivo (reemplazamos puntos por guiones bajos)
      const sanitizedKey = file.replace(/\./g, '_');
      const filePath = path.join(SESSION_DIR, file);
      const fileContent = fs.readFileSync(filePath);
      const base64Content = fileContent.toString('base64');

      const fileSize = Buffer.byteLength(base64Content, 'utf8');
      totalSize += fileSize;
      console.log(`[Session] Archivo: ${file} (${sanitizedKey}) - Tamaño base64: ${fileSize} bytes`);

      sessionData[sanitizedKey] = base64Content;
    }

    console.log(`[Session] Tamaño total de sessionData: ${totalSize} bytes`);

    if (totalSize > 1000000) {
      console.error("[Session] El tamaño total de la sesión excede el límite permitido de Firestore (1MB).");
      return;
    }

    // Guardar la sesión en Firestore
    await db.collection('wwebjs_auth').doc('vicebot-test').set({
      sessionData,
      updatedAt: Timestamp.now()
    }, { merge: true });

    console.log("[Auth] Sesión guardada correctamente en Firestore.");
  } catch (error) {
    console.error("[Auth] Error al guardar la sesión:", error);
  }
}

// Ejecutar la función de prueba para guardar la sesión
saveSessionData();


//Sesion alm