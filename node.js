const { Client, RemoteAuth } = require('whatsapp-web.js');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Cargar credenciales de Firebase
const serviceAccount = require('./firebase_credentials.json');

// Inicializar Firebase
initializeApp({
    credential: cert(serviceAccount)
});
const db = getFirestore();

// Implementar FirestoreStore para almacenamiento de sesión
class FirestoreStore {
    constructor(db, collectionName = 'wwebjs_sessions') {
        this.collection = db.collection(collectionName);
    }

    async get(session) {
        console.log(`[FirestoreStore] 🔍 Buscando sesión en Firestore: ${session}`);
        const doc = await this.collection.doc(session).get();
        if (doc.exists) {
            console.log(`[FirestoreStore] ✅ Sesión encontrada en Firestore para: ${session}`);
            return doc.data();
        } else {
            console.warn(`[FirestoreStore] ❌ No se encontró sesión en Firestore para: ${session}`);
            return null;
        }
    }

    async set(session, data) {
        console.log(`[FirestoreStore] 🔄 Intentando guardar sesión en Firestore: ${session}`);
        console.log(`[FirestoreStore] 📂 Datos que intentamos guardar:`, JSON.stringify(data, null, 2));
        try {
            await this.collection.doc(session).set(data, { merge: true });
            console.log(`[FirestoreStore] ✅ Sesión guardada con éxito en Firestore.`);
        } catch (error) {
            console.error(`[FirestoreStore] ❌ Error guardando sesión en Firestore:`, error);
        }
    }

    async remove(session) {
        console.log(`[FirestoreStore] 🗑 Eliminando sesión en Firestore: ${session}`);
        await this.collection.doc(session).delete();
    }

    async sessionExists({ session }) {
        console.log(`[FirestoreStore] 🔍 Verificando existencia de sesión en Firestore: ${session}`);
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

// Eventos del cliente
client.on('qr', (qr) => {
    console.warn("[Auth] 📌 Escanea este QR en WhatsApp para iniciar sesión:");
});

client.on('ready', () => {
    console.log('[Auth] ✅ Bot de WhatsApp conectado y autenticado correctamente.');
});

client.on('authenticated', () => {
    console.log("[Auth] ✅ Autenticación exitosa. Guardando sesión en Firestore...");
});

client.on('auth_failure', (message) => {
    console.error(`[Auth] ❌ Error de autenticación: ${message}`);
});

client.on('disconnected', (reason) => {
    console.warn(`[Auth] ⚠️ Cliente desconectado: ${reason}`);
    if (reason === 'LOGOUT') {
        console.warn("[Auth] ❌ Se cerró sesión. Escanea el QR nuevamente.");
    }
});

client.on('error', (error) => {
    console.error("[Auth] ❌ Error en el cliente:", error);
});

// Iniciar el cliente
client.initialize();
//Codigo con emokis