const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');  

const client = new Client({
    authStrategy: new LocalAuth()
});

// Cargar palabras clave en un Set (para búsqueda rápida)
let keywordsIt = new Set();
let keywordsMan = new Set();
let keywordsAma = new Set();

function loadKeywords() {
    try {
        // Cargar palabras clave de IT
        const dataIt = fs.readFileSync('keywords_it.txt', 'utf8');
        keywordsIt = new Set(dataIt.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('✅ Palabras clave IT cargadas:', [...keywordsIt]);

        // Cargar palabras clave de Man
        const dataMan = fs.readFileSync('keywords_man.txt', 'utf8');
        keywordsMan = new Set(dataMan.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('✅ Palabras clave Man cargadas:', [...keywordsMan]);

        // Cargar palabras clave de Ama
        const dataAma = fs.readFileSync('keywords_ama.txt', 'utf8');
        keywordsAma = new Set(dataAma.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('✅ Palabras clave Ama cargadas:', [...keywordsAma]);

    } catch (err) {
        console.error('❌ Error al leer los archivos de palabras clave:', err);
    }
}

// Evento para mostrar el QR
client.on('qr', qr => {
    console.log('🔹 Escanea este QR con WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

// Evento cuando el cliente está listo
client.on('ready', async () => {
    console.log('✅ Bot de WhatsApp conectado y listo.');
    loadKeywords();  // Cargar palabras clave al iniciar

    const chats = await client.getChats();
    console.log(`📌 Chats disponibles: ${chats.length}`);

    const groups = chats.filter(chat => chat.id._serialized.endsWith('@g.us'));
    console.log(`📌 Grupos disponibles: ${groups.length}`);
    groups.forEach(group => {
        console.log(`📌 Grupo: ${group.name} - ID: ${group.id._serialized}`);
    });
});

// Evento para recibir y procesar los mensajes
client.on('message', async message => {
    console.log(`📩 Mensaje recibido: "${message.body}"`);

    const groupITPruebaId = '120363389868056953@g.us';  
    const groupBotDestinoId = '120363408965534037@g.us';  
    const groupMantenimientoId = '120363393791264206@g.us';  
    const groupAmaId = '120363409776076000@g.us'; 

    const chat = await message.getChat();

    if (!chat.id._serialized.endsWith('@g.us')) return;
    if (chat.id._serialized !== groupITPruebaId) return;

    const cleanedMessage = message.body.toLowerCase().replace(/[.,!?()]/g, '');
    const words = cleanedMessage.split(/\s+/);

    let foundIT = words.some(word => keywordsIt.has(word));
    let foundMan = words.some(word => keywordsMan.has(word));
    let foundAma = words.some(word => keywordsAma.has(word));

    let media = null;
    if (message.hasMedia) {
        media = await message.downloadMedia();
    }

    if (foundIT) {
        const targetChatIT = await client.getChatById(groupBotDestinoId);
        await targetChatIT.sendMessage(message.body);
        if (media) await targetChatIT.sendMessage(media);
    }

    if (foundMan) {
        const targetChatMan = await client.getChatById(groupMantenimientoId);
        await targetChatMan.sendMessage(message.body);
        if (media) await targetChatMan.sendMessage(media);
    }

    if (foundAma) {
        const targetChatAma = await client.getChatById(groupAmaId);
        await targetChatAma.sendMessage(message.body);
        if (media) await targetChatAma.sendMessage(media);
    }
});

client.initialize();
//PRUEBA IMAGE