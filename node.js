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
        console.log(`[FirestoreStore] Verificando existencia de sesión en Firestore: ${session}`);
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

        if (!data || Object.keys(data).length === 0) {
            console.warn(`[FirestoreStore] ⚠️ No hay datos para guardar. Se canceló el guardado.`);
            return;
        }

        try {
            await this.collection.doc(session).set(data, { merge: true });
            console.log(`[FirestoreStore] ✅ Sesión guardada con éxito en Firestore.`);
        } catch (error) {
            console.error(`[FirestoreStore] ❌ Error guardando sesión en Firestore:`, error);
        }
    }

    async remove(session) {
        console.log(`[FirestoreStore] Eliminando sesión en Firestore: ${session}`);
        await this.collection.doc(session).delete();
    }

    async sessionExists({ session }) {
        console.log(`[FirestoreStore] Verificando existencia de sesión en Firestore: ${session}`);
        const doc = await this.collection.doc(session).get();
        return doc.exists;
    }
}

// Crear una instancia del FirestoreStore
const store = new FirestoreStore(db);

// Configuración del cliente de WhatsApp con RemoteAuth y FirestoreStore
const client = new Client({
    authStrategy: new RemoteAuth({
        clientId: 'vicebot-test',
        store: store,
        backupSyncIntervalMs: 60000, // Guardar la sesión cada 1 minuto
    }),
    puppeteer: {
        headless: false, // Cambiar a true en producción
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// Eventos del cliente
client.on('qr', (qr) => {
    console.warn("[Auth] Escanea este QR en WhatsApp para iniciar sesión.");
});

client.on('ready', async () => {
    console.log('[Auth] Bot de WhatsApp conectado y autenticado correctamente.');
    console.log('[Auth] Verificando si la sesión está guardada en Firestore...');
    
    // Verificar si la sesión se guardó
    const sessionData = await store.get("RemoteAuth-vicebot-test");
    if (sessionData) {
        console.log("[Auth] ✅ Sesión restaurada correctamente desde Firestore.");
    } else {
        console.warn("[Auth] ❌ No se encontró sesión en Firestore.");
    }
});

client.on('authenticated', async () => {
    console.log("[Auth] ✅ Autenticación exitosa. Guardando sesión en Firestore...");
    
    // Verificar si realmente se está ejecutando set()
    const testSessionData = { test: "test" };
    await store.set("test-session", testSessionData);

    console.log("[Auth] 🔍 Prueba de escritura de sesión ejecutada.");
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

//listo code