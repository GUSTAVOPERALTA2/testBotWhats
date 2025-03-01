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

    // Reenvío con log para cada grupo
    let originalMessageId;
    let originalMessageText = message.body;  // Guardar el texto original del mensaje

    if (foundIT) {
        console.log("Mensaje con palabra clave para IT, reenviando...");
        const targetChatIT = await client.getChatById(groupBotDestinoId);
        const sentMessage = await targetChatIT.sendMessage(message.body);
        originalMessageId = sentMessage.id._serialized; // Guardamos el ID del mensaje para futuras respuestas

        if (media) await targetChatIT.sendMessage(media);
    }

    if (foundMan) {
        console.log("Mensaje con palabra clave para Mantenimiento, reenviando...");
        const targetChatMan = await client.getChatById(groupMantenimientoId);
        await targetChatMan.sendMessage(message.body);
        if (media) await targetChatMan.sendMessage(media);
    }

    if (foundAma) {
        console.log("Mensaje con palabra clave para Ama de llaves, reenviando...");
        const targetChatAma = await client.getChatById(groupAmaId);
        await targetChatAma.sendMessage(message.body);
        if (media) await targetChatAma.sendMessage(media);
    }

    // Evento para recibir respuestas a los mensajes reenviados (marcar como resuelto)
    client.on('message', async (response) => {
        // Verificar que la respuesta es al mensaje original
        if (response.reply_to_message && response.reply_to_message.id._serialized === originalMessageId) {
            console.log(`✅ Respuesta recibida a la incidencia: "${response.body}"`);

            // Notificar en el grupo original
            const chatOriginal = await client.getChatById(groupITPruebaId); // Grupo donde se reportó la incidencia
            await chatOriginal.sendMessage(`✅ El problema: "${originalMessageText}" ha sido resuelto. ¡Gracias por tu paciencia!`);

            // Opcional: Enviar el mensaje de resolución a los demás grupos
            if (foundMan) {
                const targetChatMan = await client.getChatById(groupMantenimientoId);
                await targetChatMan.sendMessage(`✅ El problema: "${originalMessageText}" ha sido resuelto.`);
            }

            if (foundAma) {
                const targetChatAma = await client.getChatById(groupAmaId);
                await targetChatAma.sendMessage(`✅ El problema: "${originalMessageText}" ha sido resuelto.`);
            }
        }
    });
});

client.initialize();
