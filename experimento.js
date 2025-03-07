const { Client, LocalAuth } = require('whatsapp-web.js');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');

// Cargar credenciales de Firebase
const serviceAccount = require('./firebase_credentials.json');

// Inicializar Firebase
initializeApp({
    credential: cert(serviceAccount)
});
const db = getFirestore();

// Funciones para manejar la sesión manualmente
async function saveSession(client) {
    try {
        const cookies = await client.pupPage.cookies();
        if (cookies.length === 0) {
            console.warn("[Auth] Advertencia: No hay cookies para guardar.");
            return;
        }

        await db.collection('wwebjs_auth').doc('vicebot-test').set({
            cookies,
            updatedAt: Timestamp.now()
        }, { merge: true });

        console.log("[Auth] Sesión guardada correctamente en Firestore.");
    } catch (error) {
        console.error("[Auth] Error al guardar la sesión:", error);
    }
}

async function loadSession(client) {
    try {
        const doc = await db.collection('wwebjs_auth').doc('vicebot-test').get();
        if (!doc.exists) {
            console.warn("[Auth] No se encontró sesión en Firestore.");
            return;
        }

        const { cookies } = doc.data();
        if (cookies.length === 0) {
            console.warn("[Auth] No hay cookies guardadas en Firestore.");
            return;
        }

        await client.pupPage.setCookie(...cookies);
        console.log("[Auth] Sesión restaurada correctamente desde Firestore.");
    } catch (error) {
        console.error("[Auth] Error al cargar la sesión:", error);
    }
}

// Configurar el cliente de WhatsApp con LocalAuth
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

client.on('qr', qr => {
    console.log('[Auth] Escanea este QR con WhatsApp Web:');
    require('qrcode-terminal').generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('[Auth] Bot de WhatsApp conectado y autenticado correctamente.');
    // Guardar la sesión en Firestore después de la autenticación
    await saveSession(client);
});

client.on('disconnected', async reason => {
    console.warn(`[Auth] El cliente se desconectó: ${reason}`);
});

client.on('auth_failure', async message => {
    console.error(`[Auth] Error de autenticación: ${message}`);
});

client.initialize();

// Cargar la sesión antes de que WhatsApp inicie
client.on('browser_page', async () => {
    console.log("[Auth] Intentando restaurar sesión desde Firestore...");
    await loadSession(client);
});
//ya nose 2