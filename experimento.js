const { Client, RemoteAuth } = require('whatsapp-web.js');
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

// Implementación personalizada de RemoteAuthStore para pruebas
class FirestoreSessionStore {
    constructor(db) {
        this.collection = db.collection('wwebjs_auth');
    }

    async sessionExists({ session }) {
        const doc = await this.collection.doc(session).get();
        console.log(`[Firestore] Verificando si existe la sesión: ${session} -> ${doc.exists}`);
        return doc.exists;
    }

    async saveSession({ session, data }) {
        if (!data || Object.keys(data).length === 0) {
            console.warn(`[Firestore] Advertencia: Datos de sesión vacíos para "${session}". No se guardará.`);
            return;
        }

        console.log(`[Firestore] Guardando sesión en Firestore para "${session}":`, JSON.stringify(data, null, 2));

        await this.collection.doc(session).set({
            data,
            updatedAt: Timestamp.now(),
        }, { merge: true });
    }

    async removeSession({ session }) {
        console.log(`[Firestore] Eliminando sesión en Firestore para "${session}".`);
        await this.collection.doc(session).delete();
    }

    async loadSession({ session }) {
        const doc = await this.collection.doc(session).get();
        if (!doc.exists) {
            console.warn(`[Firestore] No se encontró sesión en Firestore para "${session}".`);
            return null;
        }
        console.log(`[Firestore] Cargando sesión desde Firestore para "${session}".`);
        return doc.data().data;
    }

    async save({ session, data }) {
        await this.saveSession({ session, data });
    }

    async extract({ session }) {
        console.log(`[Firestore] Extrayendo sesión desde Firestore para "${session}".`);
        
        const sessionData = await this.loadSession({ session });
        
        if (!sessionData || Object.keys(sessionData).length === 0) {
            console.warn(`[Firestore] No se encontró sesión válida en Firestore para "${session}". Se iniciará una nueva sesión.`);
            return null;
        }

        console.log(`[Firestore] Sesión extraída correctamente para "${session}".`);
        return sessionData;
    }
}

// Instancia de almacenamiento en Firestore
const store = new FirestoreSessionStore(db);

// Configurar el cliente de WhatsApp con RemoteAuth
const client = new Client({
    authStrategy: new RemoteAuth({
        clientId: 'vicebot-test',
        store,
        backupSyncIntervalMs: 60000,
        syncFullHistory: true
    })
});

client.on('qr', qr => {
    console.log('[Auth] Escanea este QR con WhatsApp Web:');
    require('qrcode-terminal').generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('[Auth] Bot de WhatsApp conectado y autenticado correctamente.');

    // Intentar cargar la sesión desde Firestore
    const sessionData = await store.loadSession({ session: 'vicebot-test' });
    
    if (sessionData && Object.keys(sessionData).length > 0) {
        console.log('[Auth] Sesión cargada exitosamente desde Firestore.');
    } else {
        console.warn('[Auth] No se encontró sesión en Firestore, guardando manualmente.');

        try {
            // Extraer la sesión desde el proceso del navegador controlado por Puppeteer
            const session = client.pupBrowser.process().spawnargs;

            if (session) {
                await store.saveSession({ session: 'vicebot-test', data: { args: session } });
                console.log('[Auth] Sesión guardada manualmente en Firestore.');
            } else {
                console.error('[Auth] No se pudo obtener la sesión del cliente.');
            }
        } catch (error) {
            console.error('[Auth] Error al obtener la sesión:', error);
        }
    }
});

client.on('disconnected', async reason => {
    console.warn(`[Auth] El cliente se desconectó: ${reason}`);
});

client.on('auth_failure', async message => {
    console.error(`[Auth] Error de autenticación: ${message}`);
});

client.initialize();

//Auth remote