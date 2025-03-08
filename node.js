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

/**
 * Inicializa el cliente de WhatsApp usando el directorio de sesión
 */
function initializeBot() {
  ensureSessionDir();

  const client = new Client({
    puppeteer: {
      headless: false,
      userDataDir: SESSION_DIR,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    log('warn', 'QR recibido. Escanea el código para autenticar.');
    // Puedes agregar código para generar el código QR en consola o usar una librería.
  });

  client.on('authenticated', () => {
    log('log', 'Autenticación exitosa.');
  });

  client.on('ready', () => {
    log('log', 'Bot conectado y listo.');
  });

  client.on('disconnected', async (reason) => {
    log('warn', `El cliente se desconectó: ${reason}`);
    try {
      await client.destroy();
    } catch (err) {
      log('error', 'Error al destruir el cliente:', err);
    }
    // Reinicializamos el bot
    initializeBot();
  });

  client.on('error', async (error) => {
    log('error', 'Error detectado:', error);
    try {
      await client.destroy();
    } catch (err) {
      log('error', 'Error al destruir el cliente tras el error:', err);
    }
    initializeBot();
  });

  client.initialize();
}

/**
 * Función para iniciar el bot
 */
function startBot() {
  initializeBot();
}

// Manejo de la señal SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  log('log', 'Señal SIGINT recibida. Finalizando proceso...');
  process.exit(0);
});

// Iniciar el bot
startBot();


//chrome_session