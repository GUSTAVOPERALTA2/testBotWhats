const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

// Directorio para almacenar la sesión local
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
    // Aquí podrías agregar un mecanismo para imprimir o renderizar el QR
  });

  client.on('authenticated', (session) => {
    log('log', 'Autenticación exitosa.');
    // La sesión se guarda automáticamente en el directorio SESSION_DIR.
    // Puedes loguear la sesión (sin datos sensibles) para depuración.
    log('log', 'Datos de sesión:', session);
  });

  client.on('ready', () => {
    log('log', 'Bot conectado y listo.');
  });

  client.on('disconnected', async (reason) => {
    log('warn', `El cliente se desconectó: ${reason}`);
    try {
      await client.destroy();
      log('log', 'Cliente destruido correctamente tras la desconexión.');
    } catch (err) {
      log('error', 'Error al destruir el cliente:', err);
    }
    // Reinicia el bot automáticamente para intentar reconectar
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
    // Reinicia el bot automáticamente después de un error
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

// Manejo de la señal SIGINT (Ctrl+C) para un apagado controlado
process.on('SIGINT', async () => {
  log('log', 'Señal SIGINT recibida. Iniciando proceso de cierre controlado...');
  try {
    if (client) {
      await client.destroy();
      log('log', 'Cliente destruido correctamente en SIGINT.');
    }
  } catch (err) {
    log('error', 'Error al destruir el cliente en SIGINT:', err);
  }
  // Finaliza el proceso
  process.exit(0);
});

// Iniciar el bot
startBot();
