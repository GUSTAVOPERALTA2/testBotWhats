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

// Función para guardar la sesión del navegador en Firestore
async function saveSessionData() {
    try {
        const sessionFiles = fs.readdirSync(SESSION_DIR)
            .filter(file => !IGNORED_FILES.includes(file) && fs.statSync(path.join(SESSION_DIR, file)).isFile());
        const sessionData = {};

        for (const file of sessionFiles) {
            const filePath = path.join(SESSION_DIR, file);
            sessionData[file] = fs.readFileSync(filePath, 'base64');
        }

        await db.collection('wwebjs_auth').doc('vicebot-test').set({
            sessionData,
            updatedAt: Timestamp.now()
        }, { merge: true });

        console.log("[Auth] Sesión completa del navegador guardada en Firestore.");
    } catch (error) {
        console.error("[Auth] Error al guardar la sesión completa:", error);
    }
}

// Función para restaurar la sesión del navegador desde Firestore
async function loadSessionData() {
    try {
        const doc = await db.collection('wwebjs_auth').doc('vicebot-test').get();
        if (!doc.exists) {
            console.warn("[Auth] No se encontró sesión en Firestore.");
            return false;
        }

        const { sessionData } = doc.data();
        if (!sessionData) {
            console.warn("[Auth] No hay datos de sesión en Firestore.");
            return false;
        }

        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        for (const [file, content] of Object.entries(sessionData)) {
            const filePath = path.join(SESSION_DIR, file);
            fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
        }

        console.log("[Auth] Sesión del navegador restaurada desde Firestore.");
        return true;
    } catch (error) {
        console.error("[Auth] Error al restaurar la sesión:", error);
        return false;
    }
}

// Función para eliminar sesión inválida de Firestore
async function clearInvalidSession() {
    try {
        await db.collection('wwebjs_auth').doc('vicebot-test').delete();
        console.log("[Auth] Sesión inválida eliminada de Firestore.");
    } catch (error) {
        console.error("[Auth] Error al eliminar la sesión inválida:", error);
    }
}

// Función para reiniciar automáticamente el bot en caso de error crítico
async function restartBot() {
    console.warn("[Auth] Reiniciando bot debido a un error crítico...");
    await clearInvalidSession();
    setTimeout(() => {
        console.warn("[Auth] Reiniciando proceso...");
        exec("node " + __filename, (error, stdout, stderr) => {
            if (error) {
                console.error("[Auth] Error al reiniciar el bot:", error);
            }
            console.log(stdout);
            console.error(stderr);
        });
        process.exit(1);
    }, 5000);
}

// Restaurar sesión antes de iniciar Puppeteer
loadSessionData().then(async (sessionLoaded) => {
    if (!sessionLoaded) {
        console.warn("[Auth] No se pudo restaurar sesión, iniciando sin sesión previa.");
    }

    const client = new Client({
        puppeteer: {
            headless: false, // Permite ver el navegador
            userDataDir: SESSION_DIR, // Usa el perfil persistente
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', async () => {
        console.warn("[Auth] Se ha solicitado un nuevo QR, eliminando sesión anterior en Firestore...");
        await clearInvalidSession();
    });

    client.on('ready', async () => {
        console.log('[Auth] Bot de WhatsApp conectado y autenticado correctamente.');
        await saveSessionData();
    });

    client.on('disconnected', async reason => {
        console.warn(`[Auth] El cliente se desconectó: ${reason}`);
        if (reason === 'NAVIGATION') {
            console.warn("[Auth] Sesión posiblemente cerrada en el móvil, eliminando de Firestore...");
            await clearInvalidSession();
        }
    });

    client.on('auth_failure', async message => {
        console.error(`[Auth] Error de autenticación: ${message}`);
        await clearInvalidSession();
    });

    client.on('error', async error => {
        console.error("[Auth] Error detectado en Puppeteer:", error);
        if (error.message.includes("Execution context was destroyed")) {
            console.warn("[Auth] Error crítico, reiniciando bot...");
            restartBot();
        }
    });

    client.initialize().catch(async (error) => {
        console.error("[Auth] Error en la inicialización del bot:", error);
        restartBot();
    });
});


//Test error nuevo