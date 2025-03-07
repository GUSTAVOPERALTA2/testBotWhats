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
        await this.collection.doc(session).set({
            data,
            updatedAt: Timestamp.now(),
        });
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
}

// Instancia de almacenamiento en Firestore
const store = new FirestoreSessionStore(db);

// Variables de palabras clave
let keywordsIt = new Set();
let keywordsMan = new Set();
let keywordsAma = new Set();
let confirmationKeywords = [];

// Función para cargar palabras clave desde archivos de texto
function loadKeywords() {
    const loadFile = (filename) => {
        try {
            if (!fs.existsSync(filename)) {
                console.warn(`Advertencia: El archivo ${filename} no existe.`);
                return [];
            }
            return fs.readFileSync(filename, 'utf8')
                .split('\n')
                .map(word => word.trim().toLowerCase())
                .filter(word => word);
        } catch (err) {
            console.error(`Error al leer ${filename}:`, err);
            return [];
        }
    };

    keywordsIt = new Set(loadFile('keywords_it.txt'));
    keywordsMan = new Set(loadFile('keywords_man.txt'));
    keywordsAma = new Set(loadFile('keywords_ama.txt'));
    confirmationKeywords = loadFile('keywords_confirm.txt');

    console.log('Palabras clave IT cargadas:', [...keywordsIt]);
    console.log('Palabras clave Man cargadas:', [...keywordsMan]);
    console.log('Palabras clave Ama cargadas:', [...keywordsAma]);
    console.log('Frases de confirmación cargadas:', confirmationKeywords);
}

// Configurar el cliente de WhatsApp con RemoteAuth
const client = new Client({
    authStrategy: new RemoteAuth({
        clientId: 'bot-whatsapp',
        store,
        backupSyncIntervalMs: 60000
    })
});

client.on('qr', qr => {
    console.log('Escanea este QR con WhatsApp Web:');
    require('qrcode-terminal').generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Bot de WhatsApp conectado y listo.');
    loadKeywords(); // Cargar palabras clave al iniciar

    const chats = await client.getChats();
    console.log(`Chats disponibles: ${chats.length}`);

    const groups = chats.filter(chat => chat.id._serialized.endsWith('@g.us'));
    console.log(`Grupos disponibles: ${groups.length}`);
    groups.forEach(group => {
        console.log(`Grupo: ${group.name} - ID: ${group.id._serialized}`);
    });
});

client.on('message', async message => {
    console.log(`Mensaje recibido: "${message.body}"`);

    const groupBotDestinoId = '120363408965534037@g.us';  
    const groupMantenimientoId = '120363393791264206@g.us';  
    const groupAmaId = '120363409776076000@g.us'; 
    const groupPruebaId = '120363389868056953@g.us';

    const chat = await message.getChat();
    if (!chat.id._serialized.endsWith('@g.us')) return;

    const cleanedMessage = message.body.toLowerCase().replace(/[.,!?()]/g, '');
    if (!cleanedMessage.trim()) return;

    const wordsSet = new Set(cleanedMessage.split(/\s+/));
    const foundIT = [...keywordsIt].some(word => wordsSet.has(word));
    const foundMan = [...keywordsMan].some(word => wordsSet.has(word));
    const foundAma = [...keywordsAma].some(word => wordsSet.has(word));

    let media = null;
    if (message.hasMedia && (foundIT || foundMan || foundAma)) {
        media = await message.downloadMedia();
    }

    async function getChatSafe(groupId) {
        try {
            return await client.getChatById(groupId);
        } catch (error) {
            console.error(`No se pudo obtener el chat ${groupId}:`, error);
            return null;
        }
    }

    async function forwardMessage(targetGroupId, category) {
        const targetChat = await getChatSafe(targetGroupId);
        if (!targetChat) return;

        try {
            await targetChat.sendMessage(`Nueva tarea recibida:\n\n*${message.body}*`);
            if (media) await targetChat.sendMessage(media);
            console.log(`Mensaje reenviado a ${category}: ${message.body}`);
        } catch (error) {
            console.error(`Error al reenviar mensaje a ${category}:`, error);
        }
    }

    if (foundIT) await forwardMessage(groupBotDestinoId, "IT");
    if (foundMan) await forwardMessage(groupMantenimientoId, "Mantenimiento");
    if (foundAma) await forwardMessage(groupAmaId, "Ama");

    if (message.hasQuotedMsg) {
        const quotedMessage = await message.getQuotedMessage();
        if (quotedMessage.body.startsWith("Nueva tarea recibida:\n")) {
            const taskMessage = quotedMessage.body.replace('Nueva tarea recibida:\n\n', '');
            const confirmationMessage = `La tarea:\n ${taskMessage} \n está *COMPLETADA*.`;

            const responseMessage = message.body.toLowerCase();
            if (confirmationKeywords.some(keyword => responseMessage.includes(keyword))) {
                await chat.sendMessage(confirmationMessage);
                const pruebaChat = await getChatSafe(groupPruebaId);
                if (pruebaChat) await pruebaChat.sendMessage(confirmationMessage);
                console.log(`Confirmación recibida en ${chat.name}: ${taskMessage}`);
            } else {
                console.log(`Respuesta no válida en ${chat.name}: ${message.body}`);
            }
        }
    }
});

client.initialize();
//RemoteAuth8