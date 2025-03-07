const { Client, RemoteAuth } = require('whatsapp-web.js');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const qrcode = require('qrcode-terminal'); // Importar librería para mostrar QR

// Cargar credenciales de Firebase
const serviceAccount = require('./firebase_credentials.json');

// Inicializar Firebase
initializeApp({
    credential: cert(serviceAccount)
});
const db = getFirestore();

// Implementar un store de Firestore compatible con RemoteAuth
class FirestoreStore {
    constructor(db, collectionName = 'wwebjs_sessions') {
        this.collection = db.collection(collectionName);
    }

    async get(session) {
        const doc = await this.collection.doc(session).get();
        return doc.exists ? doc.data() : null;
    }

    async set(session, data) {
        await this.collection.doc(session).set(data, { merge: true });
    }

    async remove(session) {
        await this.collection.doc(session).delete();
    }

    async sessionExists({ session }) {
        const doc = await this.collection.doc(session).get();
        return doc.exists;
    }
}

// Crear una instancia del FirestoreStore
const store = new FirestoreStore(db);

// Configuración del cliente de WhatsApp con RemoteAuth y FirestoreStore
const client = new Client({
    authStrategy: new RemoteAuth({
        clientId: 'vicebot-test', // Identificador único para la sesión
        store: store, // Usar FirestoreStore como almacenamiento de sesión
        backupSyncIntervalMs: 60000, // Guardar la sesión cada 1 minuto
    }),
    puppeteer: {
        headless: true, // Para producción, debe ser true
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// Evento para mostrar el QR correctamente en la terminal
client.on('qr', (qr) => {
    console.warn("[Auth] Escanea este QR en WhatsApp para iniciar sesión:");
    qrcode.generate(qr, { small: true }); // Generar el QR visual en la consola
});

client.on('ready', () => {
    console.log('[Auth] Bot de WhatsApp conectado y autenticado correctamente.');
});

client.on('disconnected', (reason) => {
    console.warn(`[Auth] Cliente desconectado: ${reason}`);
    if (reason === 'LOGOUT') {
        console.warn("[Auth] Cierre de sesión detectado. Escanea el QR nuevamente.");
    }
});

client.on('auth_failure', (message) => {
    console.error(`[Auth] Error de autenticación: ${message}`);
});

client.on('error', (error) => {
    console.error("[Auth] Error en el cliente:", error);
});

// Iniciar el cliente
client.initialize();

//qr