const fs = require('fs');
const path = require('path');
const { Client } = require('whatsapp-web.js');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// Cargar credenciales de Firebase
const serviceAccount = require('./firebase_credentials.json');

// Inicializar Firebase
initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

// Definir el directorio donde se almacenará la sesión
const SESSION_DIR = path.join(__dirname, 'chrome_session');

// Función para restaurar la sesión desde Firestore
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
    // Asegurar que el directorio exista
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      console.log(`[Session] Directorio creado: ${SESSION_DIR}`);
    }
    // Restaurar cada archivo
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

// Función para guardar la sesión en Firestore (puedes adaptarla a tus necesidades)
async function saveSessionData() {
  try {
    const IGNORED_FILES = ['SingletonCookie', 'SingletonLock'];
    const EXCLUDED_FILES = ['BrowserMetrics-spare.pma', 'first_party_sets.db', 'first_party_sets.db-journal'];
    const sessionFiles = fs.readdirSync(SESSION_DIR)
      .filter(file =>
        !IGNORED_FILES.includes(file) &&
        !EXCLUDED_FILES.includes(file) &&
        fs.statSync(path.join(SESSION_DIR, file)).isFile()
      );

    const sessionData = {};
    for (const file of sessionFiles) {
      // Sanitizar el nombre del archivo (reemplazar puntos por guiones bajos)
      const sanitizedKey = file.replace(/\./g, '_');
      const filePath = path.join(SESSION_DIR, file);
      const fileContent = fs.readFileSync(filePath);
      const base64Content = fileContent.toString('base64');
      sessionData[sanitizedKey] = base64Content;
    }

    await db.collection('wwebjs_auth').doc('vicebot-test').set({
      sessionData,
      updatedAt: Timestamp.now()
    }, { merge: true });
    console.log("[Auth] Sesión guardada correctamente en Firestore.");
  } catch (error) {
    console.error("[Auth] Error al guardar la sesión:", error);
  }
}

// Función principal para iniciar el bot
async function startBot() {
  // Intentamos restaurar la sesión
  const sessionRestored = await loadSessionData();

  // Configurar el cliente de WhatsApp usando el directorio persistente
  const client = new Client({
    puppeteer: {
      headless: true, // o false si deseas ver el navegador
      userDataDir: SESSION_DIR,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', async (qr) => {
    console.warn("[Auth] Nuevo QR generado. Se debe escanear para autenticar.");
    // Si se genera un nuevo QR, significa que la sesión no es válida.
    // Puedes limpiar la sesión anterior en Firestore para forzar una nueva autenticación.
    await db.collection('wwebjs_auth').doc('vicebot-test').delete();
  });

  client.on('authenticated', async (session) => {
    console.log("[Auth] Autenticado exitosamente.");
    // Guarda la sesión en Firestore después de una autenticación exitosa.
    await saveSessionData();
  });

  client.on('ready', () => {
    console.log("[Auth] Bot de WhatsApp está listo y autenticado.");
  });

  client.on('auth_failure', async (msg) => {
    console.error("[Auth] Fallo en la autenticación:", msg);
    // Limpia la sesión en Firestore para forzar un nuevo QR en el siguiente reinicio
    await db.collection('wwebjs_auth').doc('vicebot-test').delete();
  });

  client.on('disconnected', async (reason) => {
    console.warn(`[Auth] Cliente desconectado: ${reason}`);
    // Puedes manejar la reconexión o limpiar la sesión en Firestore
    await db.collection('wwebjs_auth').doc('vicebot-test').delete();
  });

  // Inicializar el cliente
  client.initialize();
}

// Iniciar el bot
startBot();
//Hla