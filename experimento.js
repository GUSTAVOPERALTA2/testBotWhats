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

// Función para cargar cookies antes de abrir WhatsApp Web
async function loadSession(client) {
    try {
        const doc = await db.collection('wwebjs_auth').doc('vicebot-test').get();
        if (!doc.exists) {
            console.warn("[Auth] No se encontró sesión en Firestore.");
            return;
        }

        const { cookies } = doc.data();
        if (!cookies || cookies.length === 0) {
            console.warn("[Auth] No hay cookies guardadas en Firestore.");
            return;
        }

        console.log("[Auth] Aplicando TODAS las cookies en Puppeteer antes de la autenticación...");
        const page = await client.pupBrowser.newPage();
        await page.setCookie(...cookies);
        await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle0' });

        console.log("[Auth] Sesión restaurada correctamente desde Firestore.");
    } catch (error) {
        console.error("[Auth] Error al cargar la sesión:", error);
    }
}

// Función para guardar TODAS las cookies después de autenticarse
async function saveSession(client) {
    try {
        const cookies = await client.pupPage.cookies();
        if (cookies.length === 0) {
            console.warn("[Auth] Advertencia: No hay cookies para guardar.");
            return;
        }

        console.log("[Auth] Guardando TODAS las cookies en Firestore...");
        console.log(JSON.stringify(cookies, null, 2));

        await db.collection('wwebjs_auth').doc('vicebot-test').set({
            cookies,
            updatedAt: Timestamp.now()
        }, { merge: true });

        console.log("[Auth] TODAS las cookies de la sesión han sido guardadas en Firestore.");
    } catch (error) {
        console.error("[Auth] Error al guardar la sesión:", error);
    }
}

// Configurar el cliente de WhatsApp con LocalAuth
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: false } // Cambia a "false" para depuración
});

// Antes de inicializar el bot, intentamos cargar TODAS las cookies desde Firestore
client.on('browser_page', async () => {
    console.log("[Auth] Intentando restaurar TODAS las cookies desde Firestore antes de iniciar WhatsApp...");
    await loadSession(client);
});

client.on('qr', qr => {
    console.log('[Auth] Escanea este QR con WhatsApp Web:');
    require('qrcode-terminal').generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('[Auth] Bot de WhatsApp conectado y autenticado correctamente.');
    // Guardar TODAS las cookies en Firestore después de la autenticación
    await saveSession(client);
});

client.on('disconnected', async reason => {
    console.warn(`[Auth] El cliente se desconectó: ${reason}`);
});

client.on('auth_failure', async message => {
    console.error(`[Auth] Error de autenticación: ${message}`);
});

client.initialize();
//Auth nuevo