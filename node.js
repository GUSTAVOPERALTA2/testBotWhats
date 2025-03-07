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
 * Función para sanitizar el nombre de un archivo, reemplazando caracteres problemáticos.
 * @param {string} fileName - Nombre original del archivo.
 * @returns {string} - Nombre sanitizado.
 */
function sanitizeFileName(fileName) {
  return fileName.replace(/[.#$/\[\]]/g, '_');
}

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

/**
 * Guarda la sesión del navegador en Firestore, almacenando cada archivo en la subcolección "session_files".
 */
async function saveSessionData() {
  try {
    const sessionFiles = fs.readdirSync(SESSION_DIR)
      .filter(file => !IGNORED_FILES.includes(file) && fs.statSync(path.join(SESSION_DIR, file)).isFile());

    const sessionDocRef = db.collection('wwebjs_auth').doc('vicebot-test');

    // Actualizar el campo updatedAt en el documento principal
    await sessionDocRef.set({ updatedAt: Timestamp.now() }, { merge: true });

    // Guardar cada archivo en la subcolección "session_files"
    for (const file of sessionFiles) {
      const sanitizedFileName = sanitizeFileName(file);
      const filePath = path.join(SESSION_DIR, file);
      const content = fs.readFileSync(filePath, 'base64');
      await sessionDocRef.collection('session_files').doc(sanitizedFileName).set({
        fileName: file,       // Nombre original del archivo
        content,              // Contenido en base64
        updatedAt: Timestamp.now()
      });
    }

    log('log', 'Sesión completa del navegador guardada en Firestore.');
  } catch (error) {
    log('error', 'Error al guardar la sesión completa:', error);
  }
}

/**
 * Restaura la sesión del navegador desde Firestore leyendo los documentos de la subcolección "session_files".
 * @returns {Promise<boolean>} - true si se restauró la sesión; false en caso contrario.
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

    log('log', 'Sesión del navegador restaurada desde Firestore.');
    return true;
  } catch (error) {
    log('error', 'Error al restaurar la sesión:', error);
    return false;
  }
}

/**
 * Elimina la sesión inválida de Firestore borrando el documento principal y todos los documentos de la subcolección "session_files".
 */
async function clearInvalidSession() {
  try {
    const sessionDocRef = db.collection('wwebjs_auth').doc('vicebot-test');
    // Borrar documentos de la subcolección "session_files"
    const sessionFilesSnapshot = await sessionDocRef.collection('session_files').get();
    const batch = db.batch();
    sessionFilesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Borrar el documento principal (opcional)
    await sessionDocRef.delete();
    log('log', 'Sesión inválida eliminada de Firestore.');
  } catch (error) {
    log('error', 'Error al eliminar la sesión inválida:', error);
  }
}

/**
 * Reinicia el bot.
 * @param {boolean} clearSession - Indica si se debe limpiar la sesión antes de reiniciar.
 */
function restartBot(clearSession = true) {
  if (clearSession) {
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
  } else {
    log('warn', 'Reiniciando bot manualmente sin limpiar la sesión...');
    setTimeout(() => {
      log('warn', 'Reiniciando proceso...');
      exec(`node ${__filename}`, (error, stdout, stderr) => {
        if (error) {
          log('error', 'Error al reiniciar el bot:', error);
        }
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
      });
      process.exit(0);
    }, 5000);
  }
}

/**
 * Función principal para iniciar el bot.
 */
async function startBot() {
  try {
    const sessionLoaded = await loadSessionData();
    if (!sessionLoaded) {
      log('warn', 'No se pudo restaurar la sesión, iniciando sin sesión previa.');
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

// Manejo de la señal SIGINT (Ctrl+C) para reinicio automático sin limpiar la sesión
process.on('SIGINT', () => {
  log('log', 'Recibida señal SIGINT. Reiniciando el bot de forma automática sin limpiar la sesión...');
  restartBot(false);
});

// Iniciar el bot
startBot();

//codigo bonito