const { Client } = require('whatsapp-web.js');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

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

let client; // Variable global para reiniciar el cliente

// Función para guardar la sesión en Firestore
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

        console.log("[Auth] Sesión guardada en Firestore.");
    } catch (error) {
        console.error("[Auth] Error al guardar la sesión:", error);
    }
}

// Función para restaurar la sesión desde Firestore
async function loadSessionData() {
    try {
        const doc = await db.collection('wwebjs_auth').doc('vicebot-test').get();
        if (!doc.exists || !doc.data().sessionData) {
            console.warn("[Auth] No hay sesión guardada en Firestore.");
            return false;
        }

        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        for (const [file, content] of Object.entries(doc.data().sessionData)) {
            fs.writeFileSync(path.join(SESSION_DIR, file), Buffer.from(content, 'base64'));
        }

        console.log("[Auth] Sesión restaurada desde Firestore.");
        return true;
    } catch (error) {
        console.error("[Auth] Error al restaurar la sesión:", error);
        return false;
    }
}

// Función para eliminar una sesión inválida de Firestore
async function clearInvalidSession() {
    try {
        await db.collection('wwebjs_auth').doc('vicebot-test').delete();
        console.log("[Auth] Sesión inválida eliminada de Firestore.");
    } catch (error) {
        console.error("[Auth] Error al eliminar la sesión:", error);
    }
}

// Función para reiniciar el bot sin salir del proceso
async function restartBot() {
    console.warn("[Auth] Reiniciando bot debido a un error crítico...");
    await clearInvalidSession();

    console.warn("[Auth] Esperando 5 segundos antes de reiniciar...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.warn("[Auth] Reiniciando cliente de WhatsApp...");
    initializeWhatsAppClient(); // Reiniciar el bot
}

// Función para inicializar el cliente de WhatsApp
async function initializeWhatsAppClient() {
    const sessionLoaded = await loadSessionData();
    if (!sessionLoaded) {
        console.warn("[Auth] No se pudo restaurar sesión, iniciando sin sesión previa.");
    }

    client = new Client({
        puppeteer: {
            headless: true, // Para producción, debe ser true
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
        if (reason === 'LOGOUT') {
            console.warn("[Auth] Se detectó un cierre de sesión. Eliminando y esperando reconexión...");
            await clearInvalidSession();
        }
    });

    client.on('authenticated', async () => {
        console.log("[Auth] Autenticación exitosa. Guardando sesión nuevamente...");
        await saveSessionData();
    });

    client.on('auth_failure', async message => {
        console.error(`[Auth] Error de autenticación: ${message}`);
        await clearInvalidSession();
    });

    client.on('error', async error => {
        console.error("[Auth] Error detectado en Puppeteer:", error);
        if (error.message.includes("Execution context was destroyed")) {
            console.warn("[Auth] Error crítico, reiniciando bot...");
            restartBot(); // Reiniciar de forma controlada
        }
    });

    try {
        await client.initialize();
    } catch (error) {
        console.error("[Auth] Error en la inicialización del bot:", error);
        restartBot();
    }
}

// Iniciar el bot
initializeWhatsAppClient();

//NUEVO ENFOQUE