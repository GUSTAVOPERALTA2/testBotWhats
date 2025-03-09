const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, 'chrome_session');

let isExiting = false; // Flag para indicar cierre intencional (Ctrl+C)
let client; // Variable global para el cliente

// Función de registro con fecha y hora
function log(level, message, error) {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] [Auth] ${message}`);
  if (error) console[level](error);
}

// Verifica que exista el directorio de sesión; si no, lo crea
function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    log('warn', 'No se encontró el directorio de sesión, se creará uno.');
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  } else {
    log('log', 'Directorio de sesión encontrado, se utilizará para la autenticación.');
  }
}

// Función para eliminar el directorio de sesión
function clearSessionDir() {
  if (fs.existsSync(SESSION_DIR)) {
    try {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      log('log', 'Directorio de sesión eliminado.');
    } catch (err) {
      log('error', 'Error al eliminar el directorio de sesión:', err);
    }
  }
}

/**
 * Inicializa el cliente de WhatsApp usando el directorio de sesión
 */
function initializeBot() {
  ensureSessionDir();

  log('log', 'Inicializando el cliente de WhatsApp...');
  client = new Client({
    puppeteer: {
      headless: false,
      userDataDir: SESSION_DIR,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    log('warn', 'QR recibido. Escanea el código para autenticar.');
    // Aquí puedes imprimir o renderizar el QR.
  });

  client.on('authenticated', (session) => {
    log('log', 'Autenticación exitosa.');
    // Se guardan los datos de sesión en chrome_session automáticamente.
    log('log', 'Datos de sesión (para depuración, sin datos sensibles):', session);
  });

  client.on('ready', () => {
    log('log', 'Bot conectado y listo.');
  });

  client.on('disconnected', async (reason) => {
    log('warn', `El cliente se desconectó: ${reason}`);
    
    if (!isExiting) {
      const lowerReason = reason.toLowerCase();
      if (lowerReason.includes('logout') || lowerReason.includes('session invalidated')) {
        log('warn', 'La sesión fue cerrada desde la app. Se eliminará el directorio de sesión.');
        clearSessionDir();
      }
    } else {
      log('log', 'El cierre es intencional; no se eliminará la sesión.');
    }
    
    try {
      await client.destroy();
      log('log', 'Cliente destruido correctamente tras la desconexión.');
    } catch (err) {
      // Capturamos y manejamos el error de "Target closed"
      if (err.message && err.message.includes('Target closed')) {
        log('warn', 'Error esperado al destruir la conexión (Target closed). Se ignora.');
      } else {
        log('error', 'Error al destruir el cliente:', err);
      }
    }
    
    if (!isExiting) {
      setTimeout(() => {
        log('log', 'Reinicializando bot...');
        initializeBot();
      }, 2000);
    }
  });

  client.on('error', async (error) => {
    log('error', 'Error detectado:', error);
    try {
      await client.destroy();
      log('log', 'Cliente destruido correctamente tras el error.');
    } catch (err) {
      if (err.message && err.message.includes('Target closed')) {
        log('warn', 'Error esperado al destruir la conexión (Target closed). Se ignora.');
      } else {
        log('error', 'Error al destruir el cliente tras el error:', err);
      }
    }
    if (!isExiting) {
      setTimeout(() => {
        log('log', 'Reinicializando bot después del error...');
        initializeBot();
      }, 2000);
    }
  });

  client.initialize();
}

/**
 * Función para iniciar el bot
 */
function startBot() {
  initializeBot();
}

// Manejo de la señal SIGINT (Ctrl+C) para un cierre controlado
process.on('SIGINT', async () => {
  isExiting = true;
  log('log', 'Señal SIGINT recibida. Guardando sesión y cerrando de forma controlada...');
  try {
    if (client) {
      await client.destroy();
      log('log', 'Cliente destruido correctamente en SIGINT.');
    }
  } catch (err) {
    log('error', 'Error al destruir el cliente en SIGINT:', err);
  }
  process.exit(0);
});

// Manejo global de excepciones no capturadas
process.on('uncaughtException', (err) => {
  log('error', 'Excepción no capturada:', err);
});

// Iniciar el bot
startBot();

//Flag experimento 2