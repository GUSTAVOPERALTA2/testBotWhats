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

// Ruta donde se guardará el perfil de navegación
const SESSION_DIR = path.join(__dirname, 'chrome_session');
const IGNORED_FILES = ['SingletonCookie', 'SingletonLock'];

/**
 * Registra un mensaje con fecha y hora.
 * @param {string} level - Nivel del log (log, warn, error).
 * @param {string} message - Mensaje a registrar.
 * @param {Error} [error] - Error opcional para imprimir.
 */
function log(level, message, error) {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] [Auth] ${message}`);
  if (error) {
    console[level](error);
  }
}

// Función para guardar la sesión del navegador en Firestore
async function saveSessionData() {
  try {
    const sessionFiles = fs.readdirSync(SESSION_DIR)
      .filter(file => !IGNORED_FILES.includes(file) && fs.statSync(path.join(SESSION_DIR, file)).isFile());
    const sessionData = {};

    for (const file of sessionFiles) {
      const filePath = path.join(SESSION_DIR, file);
      sessionData[file] = fs.readFileSync(filePath, 'base64');
    }

    await db.collection('wwebjs_auth').doc('vicebot-test').set({
      sessionData,
      updatedAt: Timestamp.now()
    }, { merge: true });

    log('log', 'Sesión completa del navegador guardada en Firestore.');
  } catch (error) {
    log('error', 'Error al guardar la sesión completa:', error);
  }
}

// Función para restaurar la sesión del navegador desde Firestore
async function loadSessionData() {
  try {
    const doc = await db.collection('wwebjs_auth').doc('vicebot-test').get();
    if (!doc.exists) {
      log('warn', 'No se encontró sesión en Firestore.');
      return false;
    }

    const { sessionData } = doc.data();
    if (!sessionData) {
      log('warn', 'No hay datos de sesión en Firestore.');
      return false;
    }

    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    for (const [file, content] of Object.entries(sessionData)) {
      const filePath = path.join(SESSION_DIR, file);
      fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
    }

    log('log', 'Sesión del navegador restaurada desde Firestore.');
    return true;
  } catch (error) {
    log('error', 'Error al restaurar la sesión:', error);
    return false;
  }
}

// Función para eliminar sesión inválida de Firestore
async function clearInvalidSession() {
  try {
    await db.collection('wwebjs_auth').doc('vicebot-test').delete();
    log('log', 'Sesión inválida eliminada de Firestore.');
  } catch (error) {
    log('error', 'Error al eliminar la sesión inválida:', error);
  }
}

// Función para reiniciar automáticamente el bot en caso de error crítico
function restartBot() {
  log('warn', 'Reiniciando bot debido a un error crítico...');
  clearInvalidSession().finally(() => {
    setTimeout(() => {
      log('warn', 'Reiniciando proceso...');
      exec(`node ${__filename}`, (error, stdout, stderr) => {
        if (error) {
          log('error', 'Error al reiniciar el bot:', error);
        }
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
      });
      process.exit(1);
    }, 5000);
  });
}

// Función principal para iniciar el bot
async function startBot() {
  try {
    const sessionLoaded = await loadSessionData();
    if (!sessionLoaded) {
      log('warn', 'No se pudo restaurar sesión, iniciando sin sesión previa.');
    }

    const client = new Client({
      puppeteer: {
        headless: false, // Permite ver el navegador
        userDataDir: SESSION_DIR, // Usa el perfil persistente
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    client.on('qr', async () => {
      log('warn', 'Se ha solicitado un nuevo QR, eliminando sesión anterior en Firestore...');
      await clearInvalidSession();
    });

    client.on('ready', async () => {
      log('log', 'Bot de WhatsApp conectado y autenticado correctamente.');
      await saveSessionData();
    });

    client.on('authenticated', async () => {
      log('log', 'Autenticación exitosa. Guardando sesión nuevamente...');
      await saveSessionData();
    });

    client.on('disconnected', async (reason) => {
      log('warn', `El cliente se desconectó: ${reason}`);
      if (reason === 'LOGOUT') {
        log('warn', 'Se detectó un cierre de sesión. Eliminando sesión y esperando reconexión...');
        await clearInvalidSession();
      }
    });

    client.on('auth_failure', async (message) => {
      log('error', `Error de autenticación: ${message}`);
      await clearInvalidSession();
    });

    client.on('error', async (error) => {
      log('error', 'Error detectado en Puppeteer:', error);
      if (error.message.includes("Execution context was destroyed")) {
        log('warn', 'Error crítico detectado, reiniciando bot...');
        restartBot();
      }
    });

    await client.initialize();
  } catch (error) {
    log('error', 'Error general en startBot:', error);
    restartBot();
  }
}

// Manejo global de errores
process.on('uncaughtException', (error) => {
  log('error', 'Excepción no capturada:', error);
  restartBot();
});

process.on('unhandledRejection', (reason) => {
  log('error', 'Promesa no manejada:', reason);
  restartBot();
});

// Iniciar el bot
startBot();


//Mini