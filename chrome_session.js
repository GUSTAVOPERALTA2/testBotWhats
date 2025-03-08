const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, 'chrome_session');

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

let client; // Variable global para el cliente

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
    // Aquí podrías agregar código para imprimir el QR en la consola o enviarlo a alguna interfaz
  });

  client.on('authenticated', (session) => {
    log('log', 'Autenticación exitosa.');
    // Opcional: muestra algunos datos de la sesión para depuración (evita mostrar datos sensibles)
    log('log', 'Datos de sesión:', session);
  });

  client.on('ready', () => {
    log('log', 'Bot conectado y listo.');
  });

  client.on('disconnected', async (reason) => {
    log('warn', `El cliente se desconectó: ${reason}`);
    // Si el motivo de desconexión indica que la sesión fue cerrada/invalidada desde el teléfono, se limpia la sesión.
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('logout') || lowerReason.includes('session invalidated')) {
      log('warn', 'La sesión fue invalidada. Se procederá a eliminar el directorio de sesión.');
      clearSessionDir();
    }
    try {
      await client.destroy();
      log('log', 'Cliente destruido correctamente tras la desconexión.');
    } catch (err) {
      log('error', 'Error al destruir el cliente:', err);
    }
    // Reinicializa el bot para reconectar (se generará un nuevo QR si no hay sesión válida)
    setTimeout(() => {
      log('log', 'Reinicializando bot...');
      initializeBot();
    }, 2000);
  });

  client.on('error', async (error) => {
    log('error', 'Error detectado:', error);
    try {
      await client.destroy();
      log('log', 'Cliente destruido correctamente tras el error.');
    } catch (err) {
      log('error', 'Error al destruir el cliente tras el error:', err);
    }
    setTimeout(() => {
      log('log', 'Reinicializando bot después del error...');
      initializeBot();
    }, 2000);
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
  log('log', 'Señal SIGINT recibida. Iniciando cierre controlado...');
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

// Iniciar el bot
startBot();


//Bot w12