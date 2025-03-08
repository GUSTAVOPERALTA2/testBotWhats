const { Client } = require('whatsapp-web.js');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Cargar credenciales de Firebase
const serviceAccount = require('./firebase_credentials.json');

// Inicializar Firebase
initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

// Directorio para almacenar la sesión local
const SESSION_DIR = path.join(__dirname, 'chrome_session');
// Excluimos archivos que son temporales o de estado interno que pueden invalidar la sesión
const IGNORED_FILES = [
  'SingletonCookie',
  'SingletonLock',
  'DevToolsActivePort',
  'Last Version',
  'Local State',
  'Variations',
  'first_party_sets_db',
  'first_party_sets_db-journal'
];

/**
 * Sanitiza el nombre de un archivo para usarlo como ID en Firestore.
 */
function sanitizeFileName(fileName) {
  return fileName.replace(/[.#$/\[\]]/g, '_');
}

/**
 * Registra un mensaje con fecha y hora.
 */
function log(level, message, error) {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] [Auth] ${message}`);
  if (error) {
    console[level](error);
  }
}

/**
 * Verifica si existe una sesión local en SESSION_DIR.
 */
function localSessionExists() {
  if (!fs.existsSync(SESSION_DIR)) return false;
  const files = fs.readdirSync(SESSION_DIR)
    .filter(file => !IGNORED_FILES.includes(file) && fs.statSync(path.join(SESSION_DIR, file)).isFile());
  return files.length > 0;
}

/**
 * Guarda la sesión del navegador en Firestore.
 * Cada archivo se almacena en la subcolección "session_files" del documento "vicebot-test".
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
    for (const file of sessionFiles) {
      const sanitizedFileName = sanitizeFileName(file);
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
 * Restaura la sesión del navegador desde Firestore.
 */
async function loadSessionData() {
  try {
    const sessionDocRef = db.collection('wwebjs_auth').doc('vicebot-test');
    const sessionFilesSnapshot = await sessionDocRef.collection('session_files').get();
    if (sessionFilesSnapshot.empty) {
      log('warn', 'No se encontró sesión en Firestore.');
      return false;
    }
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    sessionFilesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data && data.fileName && data.content) {
        const filePath = path.join(SESSION_DIR, data.fileName);
        fs.writeFileSync(filePath, Buffer.from(data.content, 'base64'));
      }
    });
    log('log', 'Sesión restaurada desde Firestore.');
    return true;
  } catch (error) {
    log('error', 'Error al restaurar la sesión:', error);
    return false;
  }
}

/**
 * Elimina la sesión en Firestore, borrando el documento principal y todos sus subdocumentos.
 */
async function clearInvalidSession() {
  try {
    const sessionDocRef = db.collection('wwebjs_auth').doc('vicebot-test');
    const sessionFilesSnapshot = await sessionDocRef.collection('session_files').get();
    const batch = db.batch();
    sessionFilesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    await sessionDocRef.delete();
    log('log', 'Sesión inválida eliminada de Firestore.');
  } catch (error) {
    log('error', 'Error al eliminar la sesión inválida:', error);
  }
}

let client; // Variable global para el cliente

/**
 * Inicializa el cliente de WhatsApp y configura los eventos.
 * Si no existe sesión local, intenta restaurarla desde Firestore.
 */
function initializeBot() {
  if (!localSessionExists()) {
    loadSessionData().then((sessionLoaded) => {
      if (!sessionLoaded) {
        log('warn', 'No se pudo restaurar la sesión, iniciando sin sesión previa.');
      }
    });
  } else {
    log('log', 'Sesión local encontrada, usándola para autenticación.');
  }

  client = new Client({
    puppeteer: {
      headless: false,
      userDataDir: SESSION_DIR,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    log('warn', 'Nuevo QR solicitado.');
    // Aquí puedes mostrar el QR en consola o mediante otro método.
  });

  client.on('authenticated', async () => {
    log('log', 'Autenticación exitosa.');
    await saveSessionData();
  });

  client.on('ready', async () => {
    log('log', 'Bot conectado y listo.');
    await saveSessionData();
  });

  client.on('disconnected', async (reason) => {
    log('warn', `El cliente se desconectó: ${reason}`);
    if (reason === 'LOGOUT') {
      // Cuando se cierra la sesión desde el dispositivo:
      log('warn', 'Cierre de sesión desde el dispositivo detectado. Limpiando sesión en Firestore y reinicializando para solicitar nuevo QR.');
      await clearInvalidSession();
      try {
        if (client) await client.destroy();
      } catch (err) {
        log('error', 'Error al destruir el cliente en LOGOUT:', err);
      }
      // Reinicializamos el bot para que se solicite un nuevo QR.
      initializeBot();
    } else {
      log('warn', 'Desconexión inesperada, reinicializando cliente.');
      try {
        if (client) await client.destroy();
      } catch (err) {
        log('error', 'Error al destruir el cliente en desconexión inesperada:', err);
      }
      initializeBot();
    }
  });

  client.on('error', async (error) => {
    log('error', 'Error detectado en Puppeteer:', error);
    try {
      if (client) await client.destroy();
    } catch (err) {
      log('error', 'Error al destruir el cliente (error):', err);
    }
    initializeBot();
  });

  client.initialize();
}

/**
 * Función para iniciar el bot.
 */
function startBot() {
  initializeBot();
}

// Manejo global de errores para capturar excepciones y promesas rechazadas.
process.on('uncaughtException', (error) => {
  log('error', 'Excepción no capturada:', error);
  if (client) {
    client.destroy().then(() => {
      initializeBot();
    });
  } else {
    initializeBot();
  }
});

process.on('unhandledRejection', (reason) => {
  log('error', 'Promesa no manejada:', reason);
  if (client) {
    client.destroy().then(() => {
      initializeBot();
    });
  } else {
    initializeBot();
  }
});

/**
 * Manejador para SIGINT (Ctrl+C):
 * - Guarda la sesión en Firestore.
 * - Espera 2 segundos para asegurar que el guardado se complete.
 * - Destruye el cliente actual de forma segura.
 * - Reinicializa el bot sin limpiar la sesión.
 */
process.on('SIGINT', async () => {
  log('log', 'Recibida señal SIGINT. Guardando sesión antes de reinicializar cliente...');
  try {
    await saveSessionData();
    log('log', 'Sesión guardada correctamente. Esperando 2 segundos para asegurar la persistencia...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    log('error', 'Error al guardar la sesión en SIGINT:', error);
  }
  try {
    if (client) await client.destroy();
  } catch (err) {
    log('error', 'Error al destruir el cliente en SIGINT:', err);
  }
  log('log', 'Reinicializando cliente sin limpiar la sesión.');
  initializeBot();
});

// Iniciamos el bot
startBot();


//Sistema 2