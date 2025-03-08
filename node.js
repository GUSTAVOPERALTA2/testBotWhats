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

// Función para guardar la sesión en Firestore con validación de tamaño
async function saveSessionData() {
    try {
        const sessionFiles = fs.readdirSync(SESSION_DIR)
            .filter(file => !IGNORED_FILES.includes(file) && fs.statSync(path.join(SESSION_DIR, file)).isFile());
        
        const sessionData = {};
        let totalSize = 0;
        
        for (const file of sessionFiles) {
            const sanitizedKey = sanitizeFileName(file);
            const filePath = path.join(SESSION_DIR, file);
            const fileContent = fs.readFileSync(filePath);
            const base64Content = fileContent.toString('base64');
            
            // Calcular el tamaño del archivo (en bytes)
            const fileSize = Buffer.byteLength(base64Content, 'utf8');
            totalSize += fileSize;
            
            console.log(`[Session] Archivo: ${file} (${sanitizedKey}) - Tamaño base64: ${fileSize} bytes`);
            
            // Si el archivo es demasiado grande, podrías decidir omitirlo o almacenarlo en otro lugar
            if (fileSize > 500000) { // por ejemplo, 500 KB (ajusta según tu caso)
                console.warn(`[Session] El archivo ${file} es demasiado grande y podría exceder el límite.`);
            }
            
            sessionData[sanitizedKey] = base64Content;
        }
        
        console.log(`[Session] Tamaño total de sessionData: ${totalSize} bytes`);
        
        // Verifica si el tamaño total supera el límite aproximado de 1MB
        if (totalSize > 1000000) {
            console.error("[Session] El tamaño total de la sesión excede el límite permitido de Firestore (1MB). Considera usar Cloud Storage.");
            return;
        }
        
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

//verificacion