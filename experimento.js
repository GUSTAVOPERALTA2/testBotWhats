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

// Implementación personalizada de RemoteAuthStore
class FirestoreSessionStore {
    constructor(db) {
        this.collection = db.collection('wwebjs_auth');
    }

    async sessionExists({ session }) {
        const doc = await this.collection.doc(session).get();
        return doc.exists;
    }

    async saveSession({ session, data }) {
        if (!data || Object.keys(data).length === 0) {
            console.warn(`Advertencia: Datos de sesión vacíos para "${session}". No se guardará.`);
            return;
        }

        console.log(`Intentando guardar sesión en Firestore para "${session}":`, JSON.stringify(data, null, 2));

        await this.collection.doc(session).set({
            data,
            updatedAt: Timestamp.now(),
        }, { merge: true });
    }

    async removeSession({ session }) {
        await this.collection.doc(session).delete();
    }

    async loadSession({ session }) {
        const doc = await this.collection.doc(session).get();
        return doc.exists ? doc.data().data : null;
    }

    async save({ session, data }) {
        await this.saveSession({ session, data });
    }

    async extract({ session }) {
        console.log(`Extrayendo sesión desde Firestore para "${session}"`);
        
        const sessionData = await this.loadSession({ session });
        
        if (!sessionData || Object.keys(sessionData).length === 0) {
            console.warn(`No se encontró sesión válida en Firestore para "${session}". Se iniciará una nueva sesión.`);
            return null;
        }

        return { session: sessionData };
    }
}

// Instancia de almacenamiento en Firestore
const store = new FirestoreSessionStore(db);

// Configurar el cliente de WhatsApp con RemoteAuth
const client = new Client({
    authStrategy: new RemoteAuth({
        clientId: 'vicebot',
        store,
        backupSyncIntervalMs: 60000,
        syncFullHistory: true
    })
});

client.on('qr', qr => {
    console.log('Escanea este QR con WhatsApp Web:');
    require('qrcode-terminal').generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Bot de WhatsApp conectado y listo.');

    const chats = await client.getChats();
    console.log(`Chats disponibles: ${chats.length}`);

    const groups = chats.filter(chat => chat.id._serialized.endsWith('@g.us'));
    console.log(`Grupos disponibles: ${groups.length}`);
    groups.forEach(group => {
        console.log(`Grupo: ${group.name} - ID: ${group.id._serialized}`);
    });
});

client.initialize();


//auth6