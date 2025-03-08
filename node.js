const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

// Directorio para almacenar la sesión local
const SESSION_DIR = path.join(__dirname, 'chrome_session');
// Archivo de la base de datos SQLite
const DB_PATH = path.join(__dirname, 'session.db');
// Excluimos archivos que son temporales o que no deben restaurarse
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
 * Inicializa la base de datos SQLite y crea la tabla si no existe.
 */
function initializeDatabase() {
  const db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS session_files (
      fileName TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
  return db;
}

/**
 * Función de registro con fecha y hora.
 */
function log(level, message, error) {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] [Auth] ${message}`);
  if (error) console[level](error);
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
 * Guarda la sesión del navegador en SQLite.
 */
function saveSessionData() {
  try {
    if (!fs.existsSync(SESSION_DIR)) {
      log('warn', 'No existe el directorio de sesión local.');
      return;
    }
    const sessionFiles = fs.readdirSync(SESSION_DIR)
      .filter(file => !IGNORED_FILES.includes(file) && fs.statSync(path.join(SESSION_DIR, file)).isFile());
    const db = initializeDatabase();
    
    sessionFiles.forEach(file => {
      const filePath = path.join(SESSION_DIR, file);
      const content = fs.readFileSync(filePath, 'base64');
      // Insertamos o actualizamos el registro según corresponda.
      db.run(
        `INSERT INTO session_files (fileName, content, updatedAt)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(fileName) DO UPDATE SET
           content = excluded.content,
           updatedAt = CURRENT_TIMESTAMP`,
        [file, content],
        function(err) {
          if (err) {
            log('error', `Error al guardar la sesión del archivo ${file}:`, err);
          }
        }
      );
    });
    db.close((err) => {
      if (err) {
        log('error', 'Error al cerrar la base de datos:', err);
      } else {
        log('log', 'Sesión completa guardada en SQLite.');
      }
    });
  } catch (error) {
    log('error', 'Error al guardar la sesión completa:', error);
  }
}

/**
 * Restaura la sesión del navegador desde SQLite.
 */
function loadSessionData() {
  return new Promise((resolve) => {
    try {
      const db = initializeDatabase();
      db.all(`SELECT fileName, content FROM session_files`, [], (err, rows) => {
        if (err) {
          log('error', 'Error al recuperar la sesión desde SQLite:', err);
          db.close();
          return resolve(false);
        }
        if (!rows || rows.length === 0) {
          log('warn', 'No se encontró sesión en SQLite.');
          db.close();
          return resolve(false);
        }
        // Asegurarse de que el directorio existe
        if (!fs.existsSync(SESSION_DIR)) {
          fs.mkdirSync(SESSION_DIR, { recursive: true });
        }
        rows.forEach(row => {
          const filePath = path.join(SESSION_DIR, row.fileName);
          fs.writeFileSync(filePath, Buffer.from(row.content, 'base64'));
        });
        log('log', 'Sesión restaurada desde SQLite.');
        db.close();
        return resolve(true);
      });
    } catch (error) {
      log('error', 'Error al restaurar la sesión:', error);
      return resolve(false);
    }
  });
}

/**
 * Inicializa el cliente de WhatsApp y configura los eventos.
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

  const client = new Client({
    puppeteer: {
      headless: false,
      userDataDir: SESSION_DIR,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    log('warn', 'Nuevo QR solicitado.');
  });

  client.on('authenticated', async () => {
    log('log', 'Autenticación exitosa.');
    saveSessionData();
  });

  client.on('ready', async () => {
    log('log', 'Bot conectado y listo.');
    saveSessionData();
  });

  client.on('disconnected', async (reason) => {
    log('warn', `El cliente se desconectó: ${reason}`);
    try {
      if (client) await client.destroy();
    } catch (err) {
      log('error', 'Error al destruir el cliente en desconexión:', err);
    }
    initializeBot();
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

// Manejo global de errores
process.on('uncaughtException', (error) => {
  log('error', 'Excepción no capturada:', error);
  startBot();
});

process.on('unhandledRejection', (reason) => {
  log('error', 'Promesa no manejada:', reason);
  startBot();
});

/**
 * Manejador para SIGINT (Ctrl+C):
 * - Guarda la sesión en SQLite.
 * - Espera 2 segundos para asegurar la persistencia.
 * - Reinicializa el bot sin limpiar la sesión.
 */
process.on('SIGINT', async () => {
  log('log', 'Recibida señal SIGINT. Guardando sesión antes de reinicializar cliente...');
  try {
    saveSessionData();
    log('log', 'Sesión guardada correctamente. Esperando 2 segundos para asegurar la persistencia...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    log('error', 'Error al guardar la sesión en SIGINT:', error);
  }
  startBot();
});

// Iniciamos el bot
startBot();


//SQLite3