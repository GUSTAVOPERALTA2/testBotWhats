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

// Función para guardar la sesión del navegador en Firestore
async function saveSessionData() {
    try {
        const sessionFiles = fs.readdirSync(SESSION_DIR).filter(file => fs.statSync(path.join(SESSION_DIR, file)).isFile());
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
            return;
        }

        const { sessionData } = doc.data();
        if (!sessionData) {
            console.warn("[Auth] No hay datos de sesión en Firestore.");
            return;
        }

        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        for (const [file, content] of Object.entries(sessionData)) {
            const filePath = path.join(SESSION_DIR, file);
            fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
        }

        console.log("[Auth] Sesión del navegador restaurada desde Firestore.");
    } catch (error) {
        console.error("[Auth] Error al restaurar la sesión:", error);
    }
}

// Restaurar sesión antes de iniciar Puppeteer
loadSessionData().then(() => {
    const client = new Client({
        puppeteer: {
            headless: false, // Permite ver el navegador
            userDataDir: SESSION_DIR // Usa el perfil persistente
        }
    });

    client.on('qr', qr => {
        console.log('[Auth] Escanea este QR con WhatsApp Web:');
        require('qrcode-terminal').generate(qr, { small: true });
    });

    client.on('ready', async () => {
        console.log('[Auth] Bot de WhatsApp conectado y autenticado correctamente.');
        await saveSessionData();
    });

    client.on('disconnected', async reason => {
        console.warn(`[Auth] El cliente se desconectó: ${reason}`);
    });

    client.on('auth_failure', async message => {
        console.error(`[Auth] Error de autenticación: ${message}`);
    });

    client.initialize();
});
//Nueva estrategia 3