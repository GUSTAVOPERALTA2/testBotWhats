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

    const chat = await message.getChat();

    if (!chat.id._serialized.endsWith('@g.us')) return;
    if (chat.id._serialized !== groupITPruebaId) return;

    const cleanedMessage = message.body.toLowerCase().replace(/[.,!?()]/g, '');
    const words = cleanedMessage.split(/\s+/);

    let foundIT = words.some(word => keywordsIt.has(word));
    let media = null;
    if (message.hasMedia) {
        media = await message.downloadMedia();
    }

    // Enviar mensaje al grupo IT si se encuentra una palabra clave
    if (foundIT) {
        const targetChatIT = await client.getChatById(groupBotDestinoId);
        const sentMessage = await targetChatIT.sendMessage(message.body);
        console.log(`🔹 Mensaje enviado al grupo IT con ID: ${sentMessage.id}`);

        if (media) await targetChatIT.sendMessage(media);

        // Imprimir información detallada de la referencia del mensaje
        console.log(`🔸 Mensaje original enviado: ${sentMessage.body}`);
        console.log(`🔸 ID del mensaje enviado: ${sentMessage.id}`);
        console.log(`🔸 Referencia del mensaje enviado: ${sentMessage.referenceMessage ? sentMessage.referenceMessage.id : 'Ninguna'}`);

        // Ahora monitoreamos las respuestas en IT
        client.on('message', async (responseMessage) => {
            // Imprimir información de cada mensaje recibido
            console.log(`📥 Mensaje recibido: "${responseMessage.body}"`);
            console.log(`🔸 ID del mensaje recibido: ${responseMessage.id}`);
            console.log(`🔸 ID del mensaje al que se responde: ${responseMessage.referenceMessage ? responseMessage.referenceMessage.id : 'Ninguna'}`);

            if (responseMessage.referenceMessage && responseMessage.referenceMessage.id === sentMessage.id) {
                console.log(`📝 Respuesta recibida al mensaje "${message.body}": "${responseMessage.body}"`);
            }
        });
    }
});

client.initialize();
