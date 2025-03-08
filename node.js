const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, 'chrome_session');

function ensureSessionDirExists() {
    try {
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
            console.log(`[Session] Directorio creado: ${SESSION_DIR}`);
        } else {
            console.log(`[Session] Directorio ya existe: ${SESSION_DIR}`);
        }
    } catch (error) {
        console.error(`[Session] Error al crear el directorio: ${error}`);
        // Aquí podrías decidir finalizar el proceso si el directorio es crítico
        process.exit(1);
    }
}

ensureSessionDirExists();