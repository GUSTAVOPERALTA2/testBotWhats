const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');  

const client = new Client({
    authStrategy: new LocalAuth()
});

// Cargar palabras clave en un Set (para búsqueda rápida)
let keywords = new Set();

function loadKeywords() {
    try {
        const data = fs.readFileSync('keywords_it.txt', 'utf8');
        keywords = new Set(data.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('✅ Palabras clave cargadas:', [...keywords]);
    } catch (err) {
        console.error('❌ Error al leer el archivo de palabras clave:', err);
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

    const groups = chats.filter(chat => chat.isGroup);
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

    // Solo escucha en el grupo "IT prueba"
    if (chat.id._serialized !== groupITPruebaId) return;

    // Procesar el mensaje
    const cleanedMessage = message.body.toLowerCase().replace(/[.,!?()]/g, '');  // Remueve signos de puntuación
    const words = cleanedMessage.split(/\s+/);  // Divide en palabras exactas

    // Verificar si alguna palabra está en el Set de keywords
    if (words.some(word => keywords.has(word))) {
        console.log('🔹 Mensaje contiene una palabra clave, reenviando...');

        const targetChat = await client.getChatById(groupBotDestinoId);
        await targetChat.sendMessage(message.body);
        console.log('✅ Mensaje reenviado al grupo "Bot destino".');
    }
});

// Inicializa el cliente de WhatsApp
client.initialize();