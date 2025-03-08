const fs = require('fs');
const path = require('path');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// Cargar credenciales de Firebase
const serviceAccount = require('./firebase_credentials.json');

// Inicializar Firebase
initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

// Directorio donde se almacenará la sesión (userDataDir)
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
    // Restaurar cada archivo almacenado (nombres ya sanitizados)
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

// Función para guardar la sesión en Firestore
async function saveSessionData() {
  try {
    // Lista de archivos a ignorar o excluir para filtrar solo lo esencial
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
      // Sanitizar el nombre del archivo: reemplaza puntos por guiones bajos
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
  // Intentar restaurar la sesión (si existe)
  await loadSessionData();

  // Configurar el cliente de WhatsApp usando el directorio persistente
  const client = new Client({
    puppeteer: {
      headless: false, // Cambia a false para depuración y ver el navegador
      userDataDir: SESSION_DIR,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  // Evento: Se genera un nuevo QR
  client.on('qr', (qr) => {
    console.warn("[Auth] Nuevo QR generado. Escanea el código para autenticar.");
    // Mostrar el QR en la terminal usando qrcode-terminal
    qrcode.generate(qr, { small: true });
  });

  // Evento: Autenticación exitosa
  client.on('authenticated', async (session) => {
    console.log("[Auth] Autenticado exitosamente.");
    // Guarda la sesión en Firestore tras autenticarse
    await saveSessionData();
  });

  // Evento: Bot listo
  client.on('ready', () => {
    console.log("[Auth] Bot de WhatsApp está listo y autenticado.");
  });

  // Evento: Fallo en la autenticación
  client.on('auth_failure', async (msg) => {
    console.error("[Auth] Fallo en la autenticación:", msg);
    // Opcional: limpiar la sesión en Firestore para forzar nueva autenticación
    await db.collection('wwebjs_auth').doc('vicebot-test').delete();
  });

  // Evento: Desconexión
  client.on('disconnected', async (reason) => {
    console.warn(`[Auth] Cliente desconectado: ${reason}`);
    // Opcional: limpiar la sesión en Firestore para reiniciar el proceso si es necesario
    await db.collection('wwebjs_auth').doc('vicebot-test').delete();
  });

  // Inicializar el cliente
  client.initialize();
}

// Iniciar el bot
startBot();

//Restauracion