const { Client } = require('whatsapp-web.js');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Cargar credenciales de Firebase
const serviceAccount = require('./firebase_credentials.json');

// Inicializar Firebase
initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

// Directorio para la sesión local
const SESSION_DIR = path.join(__dirname, 'chrome_session');
const IGNORED_FILES = ['SingletonCookie', 'SingletonLock'];

/**
 * Registra un mensaje con fecha y hora.
 */
function log(level, message, error) {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] [Auth] ${message}`);
  if (error) console[level](error);
}

/**
 * Guarda la sesión del navegador en Firestore.
 * Se almacenan los archivos de la sesión en la subcolección "session_files".
 */
async function saveSessionData() {
  try {
    if (!fs.existsSync(SESSION_DIR)) {
      log('warn', 'No existe el directorio de sesión local.');
      return;
    }
    const sessionFiles = fs.readdirSync(SESSION_DIR)
      .filter(file => !IGNORED_FILES.includes(file) && fs.statSync(path.join(SESSION_DIR, file)).isFile());
      
    const sessionDocRef = db.collection('wwebjs_auth').doc('vicebot-test');
    await sessionDocRef.set({ updatedAt: Timestamp.now() }, { merge: true });

    // Guardamos cada archivo en la subcolección
    for (const file of sessionFiles) {
      const sanitizedFileName = file.replace(/[.#$/\[\]]/g, '_');
      const filePath = path.join(SESSION_DIR, file);
      const content = fs.readFileSync(filePath, 'base64');
      await sessionDocRef.collection('session_files').doc(sanitizedFileName).set({
        fileName: file,
        content,
        updatedAt: Timestamp.now()
      });
    }
    log('log', 'Sesión completa guardada en Firestore.');
  } catch (error) {
    log('error', 'Error al guardar la sesión completa:', error);
  }
}

/**
 * Función principal para iniciar el bot.
 * Se intenta restaurar la sesión desde Firestore si el directorio local está vacío.
 */
async function startBot() {
  // Verificamos si existe sesión local (almacenada en SESSION_DIR)
  const localFiles = fs.existsSync(SESSION_DIR)
    ? fs.readdirSync(SESSION_DIR).filter(file => !IGNORED_FILES.includes(file))
    : [];
    
  if (localFiles.length === 0) {
    log('warn', 'Directorio de sesión vacío. Se intentará cargar la sesión desde Firestore.');
    // Aquí podrías implementar loadSessionData() para restaurar la sesión desde Firestore.
  } else {
    log('log', 'Sesión local encontrada, usándola para autenticación.');
  }

  const client = new Client({
    puppeteer: {
      headless: false,
      userDataDir: SESSION_DIR,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  // Cuando se solicita un nuevo QR (en caso de no existir sesión o sesión inválida)
  client.on('qr', (qr) => {
    log('warn', 'Nuevo QR solicitado.');
    // Puedes imprimir el QR en consola o usar otro método para mostrarlo.
  });

  // Cuando el cliente se autentica correctamente
  client.on('authenticated', async () => {
    log('log', 'Autenticación exitosa.');
    await saveSessionData(); // Guarda la sesión en Firestore
  });

  // Cuando el cliente está listo (conectado y autenticado)
  client.on('ready', async () => {
    log('log', 'Bot de WhatsApp conectado y listo.');
    await saveSessionData(); // Guarda nuevamente la sesión, por si hay cambios
  });

  client.on('disconnected', async (reason) => {
    log('warn', `El cliente se desconectó: ${reason}`);
    // Si el usuario cierra sesión desde el teléfono (LOGOUT),
    // se limpia la sesión en Firestore para forzar un nuevo QR.
    if (reason === 'LOGOUT') {
      log('warn', 'Cierre de sesión desde el teléfono detectado. Limpiando sesión en Firestore.');
      // Aquí podrías llamar a clearInvalidSession() si lo tienes implementado.
      process.exit(0);
    }
  });

  await client.initialize();
}

// Iniciar el bot
startBot();

//Nuevo inicio