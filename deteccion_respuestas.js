const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');  // Necesitarás instalar 'uuid'

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

        // Generar un ID único para este mensaje
        const messageId = uuidv4();  // ID único
        const messageContent = `${message.body} \n[ID: ${messageId}]`;  // Incluir el ID en el mensaje

        // Enviar el mensaje con el ID único
        const sentMessage = await targetChatIT.sendMessage(messageContent);
        console.log(`🔹 Mensaje enviado al grupo IT con ID: ${sentMessage.id}`);

        if (media) await targetChatIT.sendMessage(media);

        // Guardar el ID de este mensaje
        const sentMessageId = sentMessage.id;

        // Monitorear las respuestas
        client.on('message', async (responseMessage) => {
            console.log(`📥 Mensaje recibido: "${responseMessage.body}"`);
            
            // Verificar si la respuesta contiene el ID único del mensaje original
            if (responseMessage.body.includes(messageId)) {
                console.log(`📝 Respuesta recibida al mensaje original con ID ${messageId}: "${responseMessage.body}"`);
            }
        });
    }
});

client.initialize();
