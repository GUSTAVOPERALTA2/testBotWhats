const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// Cargar credenciales de Firebase
const serviceAccount = require('./firebase_credentials.json');

// Inicializar Firebase
initializeApp({
    credential: cert(serviceAccount)
});
const db = getFirestore();

// Configuración del directorio de sesión y archivos a ignorar
const SESSION_DIR = path.join(__dirname, 'chrome_session');
const IGNORED_FILES = ['SingletonCookie', 'SingletonLock'];

// Función para sanitizar nombres de archivo (por ejemplo, reemplazar puntos con guiones bajos)
function sanitizeFileName(fileName) {
    return fileName.replace(/\./g, '_');
}

// Función para guardar la sesión en Firestore
async function saveSessionData() {
    try {
        // Leer todos los archivos del directorio de sesión, filtrando los archivos ignorados
        const sessionFiles = fs.readdirSync(SESSION_DIR)
            .filter(file => !IGNORED_FILES.includes(file) && fs.statSync(path.join(SESSION_DIR, file)).isFile());
        
        // Crear un objeto para almacenar los datos de sesión en base64, sanitizando las claves
        const sessionData = {};
        for (const file of sessionFiles) {
            const sanitizedKey = sanitizeFileName(file);
            const filePath = path.join(SESSION_DIR, file);
            sessionData[sanitizedKey] = fs.readFileSync(filePath, 'base64');
        }
        
        // Guardar la sesión en Firestore con un timestamp
        await db.collection('wwebjs_auth').doc('vicebot-test').set({
            sessionData,
            updatedAt: Timestamp.now()
        }, { merge: true });
        
        console.log("[Auth] Sesión guardada correctamente en Firestore.");
    } catch (error) {
        console.error("[Auth] Error al guardar la sesión:", error);
    }
}

// Ejecutar la función de prueba para guardar la sesión
saveSessionData();
//otro