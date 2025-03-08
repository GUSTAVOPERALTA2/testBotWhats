const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal'); // En caso de necesitar mostrar el QR en la terminal, aunque por ahora mantenemos la ventana.
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

// Directorio para almacenar la sesión local
const SESSION_DIR = path.join(__dirname, 'chrome_session');
// Lista de archivos que se ignoran al guardar/restaurar. Se han removido archivos que consideramos necesarios para la sesión.
const IGNORED_FILES = [
  'SingletonCookie', 
  'SingletonLock',
  'DevToolsActivePort',
  'Last Version',
  'Local State',
  'Variations'
];

function sanitizeFileName(fileName) {
  return fileName.replace(/[.#$/\[\]]/g, '_');
}

function log(level, message, error) {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] [DEPURACIÓN] ${message}`);
  if (error) console[level](error);
}

function localSessionExists() {
  if (!fs.existsSync(SESSION_DIR)) {
    log('warn', `El directorio de sesión (${SESSION_DIR}) no existe.`);
    return false;
  }
  const files = fs.readdirSync(SESSION_DIR)
    .filter(file => !IGNORED_FILES.includes(file) && fs.statSync(path.join(SESSION_DIR, file)).isFile());
  log('log', `Archivos detectados en sesión local: ${files.join(', ')}`);
  return files.length > 0;
}

async function saveSessionData() {
  try {
    if (!fs.existsSync(SESSION_DIR)) {
      log('warn', 'No existe el directorio de sesión local para guardar.');
      return;
    }
    const sessionFiles = fs.readdirSync(SESSION_DIR)
      .filter(file => !IGNORED_FILES.includes(file) && fs.statSync(path.join(SESSION_DIR, file)).isFile());
    log('log', `Guardando archivos de sesión: ${sessionFiles.join(', ')}`);
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
      log('log', `Archivo guardado en Firestore: ${file}`);
    }
    log('log', 'Todos los archivos de sesión se han guardado en Firestore.');
  } catch (error) {
    log('error', 'Error al guardar la sesión en Firestore:', error);
  }
}

async function loadSessionData() {
  try {
    log('log', 'Intentando cargar la sesión desde Firestore...');
    const sessionDocRef = db.collection('wwebjs_auth').doc('vicebot-test');
    const sessionFilesSnapshot = await sessionDocRef.collection('session_files').get();
    if (sessionFilesSnapshot.empty) {
      log('warn', 'No se encontró sesión en Firestore.');
      return false;
    }
    if (!fs.existsSync(SESSION_DIR)) {
      log('log', `El directorio de sesión (${SESSION_DIR}) no existe, se creará ahora.`);
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    sessionFilesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data && data.fileName && data.content) {
        const filePath = path.join(SESSION_DIR, data.fileName);
        fs.writeFileSync(filePath, Buffer.from(data.content, 'base64'));
        log('log', `Archivo restaurado desde Firestore: ${data.fileName}`);
      }
    });
    // Esperar brevemente para asegurarse de que la escritura se complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    const restoredFiles = fs.readdirSync(SESSION_DIR)
      .filter(file => !IGNORED_FILES.includes(file) && fs.statSync(path.join(SESSION_DIR, file)).isFile());
    log('log', `Archivos presentes en el directorio de sesión tras restaurar: ${restoredFiles.join(', ')}`);
    return true;
  } catch (error) {
    log('error', 'Error al restaurar la sesión desde Firestore:', error);
    return false;
  }
}

async function clearInvalidSession() {
  try {
    log('log', 'Limpiando sesión inválida de Firestore...');
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
    log('error', 'Error al eliminar la sesión inválida de Firestore:', error);
  }
}

let client;

async function initializeBot() {
  log('log', 'Iniciando proceso de inicialización del bot...');
  // Intentar restaurar la sesión si no existe localmente
  if (!localSessionExists()) {
    const sessionLoaded = await loadSessionData();
    if (!sessionLoaded) {
      log('warn', 'No se pudo restaurar la sesión desde Firestore. Se iniciará sin sesión previa.');
    } else {
      log('log', 'Sesión restaurada correctamente desde Firestore.');
    }
  } else {
    log('log', 'Sesión local encontrada, se usará para la autenticación.');
  }

  client = new Client({
    puppeteer: {
      headless: false, // Mantenemos la ventana del navegador para depuración visual
      userDataDir: SESSION_DIR,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    log('warn', 'Evento QR: se ha generado un nuevo código QR.');
    // Opcional: Puedes mostrar el QR en la terminal usando qrcode-terminal
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', async (session) => {
    log('log', 'Evento authenticated: autenticación exitosa.');
    await saveSessionData();
  });

  client.on('ready', async () => {
    log('log', 'Evento ready: el bot está conectado y listo.');
    await saveSessionData();
  });

  client.on('disconnected', async (reason) => {
    log('warn', `Evento disconnected: el cliente se ha desconectado. Razón: ${reason}`);
    try {
      if (client) {
        await client.destroy();
        log('log', 'Cliente destruido correctamente tras la desconexión.');
      }
    } catch (err) {
      log('error', 'Error al destruir el cliente tras desconexión:', err);
    }
    log('log', 'Reinicializando el bot después de la desconexión...');
    await initializeBot();
  });

  client.on('error', async (error) => {
    log('error', 'Evento error: error detectado en el cliente:', error);
    try {
      if (client) {
        await client.destroy();
        log('log', 'Cliente destruido correctamente tras error.');
      }
    } catch (err) {
      log('error', 'Error al destruir el cliente tras error:', err);
    }
    log('log', 'Reinicializando el bot después de detectar un error...');
    await initializeBot();
  });

  try {
    log('log', 'Inicializando cliente de WhatsApp...');
    client.initialize();
  } catch (error) {
    log('error', 'Error al inicializar el cliente:', error);
  }
}

async function startBot() {
  await initializeBot();
}

process.on('uncaughtException', async (error) => {
  log('error', 'Excepción no capturada:', error);
  try {
    if (client) {
      await client.destroy();
      log('log', 'Cliente destruido tras excepción no capturada.');
    }
  } catch (err) {
    log('error', 'Error al destruir el cliente tras excepción:', err);
  }
  log('log', 'Reinicializando el bot tras excepción no capturada...');
  await initializeBot();
});

process.on('unhandledRejection', async (reason) => {
  log('error', 'Promesa no manejada:', reason);
  try {
    if (client) {
      await client.destroy();
      log('log', 'Cliente destruido tras promesa no manejada.');
    }
  } catch (err) {
    log('error', 'Error al destruir el cliente tras promesa no manejada:', err);
  }
  log('log', 'Reinicializando el bot tras promesa no manejada...');
  await initializeBot();
});

process.on('SIGINT', async () => {
  log('log', 'Señal SIGINT recibida. Guardando sesión antes de salir...');
  try {
    await saveSessionData();
    log('log', 'Sesión guardada correctamente. Esperando 2 segundos para asegurar la persistencia...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    log('error', 'Error al guardar la sesión en SIGINT:', error);
  }
  try {
    if (client) {
      await client.destroy();
      log('log', 'Cliente destruido correctamente tras SIGINT.');
    }
  } catch (err) {
    log('error', 'Error al destruir el cliente en SIGINT:', err);
  }
  log('log', 'Saliendo del proceso por SIGINT.');
  process.exit(0);
});

// Iniciar el bot
startBot();

//manejo de errores