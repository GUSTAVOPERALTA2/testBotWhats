const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');  

const client = new Client({
    authStrategy: new LocalAuth()
});

// Cargar palabras clave en un Set (para búsqueda rápida)
let keywordsIt = new Set();
let keywordsMan = new Set();

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
    const groupMantenimientoId = '120363393791264206@g.us';  // ID del grupo mantenimiento

    const chat = await message.getChat();

    // Verificar si el chat es un grupo (ID termina en @g.us)
    if (!chat.id._serialized.endsWith('@g.us')) {
        return;  // Si no es un grupo, no hace nada
    }

    // Solo escucha en el grupo "IT prueba"
    if (chat.id._serialized !== groupITPruebaId) return;

    // Procesar el mensaje
    const cleanedMessage = message.body.toLowerCase().replace(/[.,!?()]/g, '');  // Remueve signos de puntuación
    const words = cleanedMessage.split(/\s+/);  // Divide en palabras exactas

    // Verificar si alguna palabra está en el Set de keywords
    if (words.some(word => keywordsIt.has(word) || keywordsMan.has(word))) {
        console.log('🔹 Mensaje contiene una palabra clave, reenviando...');

        // Reenviar al grupo "Bot destino"
        const targetChatBotDestino = await client.getChatById(groupBotDestinoId);
        await targetChatBotDestino.sendMessage(message.body);
        console.log('✅ Mensaje reenviado al grupo "Bot destino".');

        // Reenviar al grupo "Mantenimiento"
        const targetChatMantenimiento = await client.getChatById(groupMantenimientoId);
        await targetChatMantenimiento.sendMessage(message.body);
        console.log('✅ Mensaje reenviado al grupo "Mantenimiento".');
    }
});

// Inicializa el cliente de WhatsApp
client.initialize();
//man3