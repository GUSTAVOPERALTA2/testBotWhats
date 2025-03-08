const fs = require('fs');
const path = require('path');
const { Timestamp } = require('firebase-admin/firestore');

// Archivos que no queremos guardar (por ejemplo, locks o cookies temporales)
const IGNORED_FILES = ['SingletonCookie', 'SingletonLock'];
const SESSION_DIR = path.join(__dirname, 'chrome_session');

async function saveSessionData() {
    try {
        // Leer todos los archivos en el directorio de sesión, ignorando los especificados
        const sessionFiles = fs.readdirSync(SESSION_DIR)
            .filter(file => !IGNORED_FILES.includes(file) && fs.statSync(path.join(SESSION_DIR, file)).isFile());
        
        // Crear un objeto para almacenar el contenido de cada archivo en base64
        const sessionData = {};
        for (const file of sessionFiles) {
            const filePath = path.join(SESSION_DIR, file);
            sessionData[file] = fs.readFileSync(filePath, 'base64');
        }
        
        // Guardar el objeto sessionData en Firestore con un timestamp
        await db.collection('wwebjs_auth').doc('vicebot-test').set({
            sessionData,
            updatedAt: Timestamp.now()
        }, { merge: true });
        
        console.log("[Auth] Sesión guardada correctamente en Firestore.");
    } catch (error) {
        console.error("[Auth] Error al guardar la sesión:", error);
    }
}
