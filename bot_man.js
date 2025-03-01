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
        // Cargar palabras clave para IT
        const dataIt = fs.readFileSync('keywords_it.txt', 'utf8');
        keywordsIt = new Set(dataIt.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('✅ Palabras clave de IT cargadas:', [...keywordsIt]);

        // Cargar palabras clave para Mantenimiento
        const dataMan = fs.readFileSync('keywords_man.txt', 'utf8');
        keywordsMan = new Set(dataMan.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('✅ Palabras clave de Mantenimiento cargadas:', [...keywordsMan]);
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

    const groups = chats.filter(chat => chat.isGroup);
    console.log(`📌 Grupos disponibles: ${groups.length}`);
    groups.forEach(group => {
        console.log(`📌 Grupo: ${group.name} - ID: ${group.id._serialized}`);
    });
});

// Evento para recibir y procesar los mensajes
client.on('message', async message => {
    console.log(`📩 Mensaje recibido: "${message.body}"`);

    // IDs de los grupos
    const groupPruebaId = '120363389868056953@g.us';  // Grupo prueba (donde llegan los mensajes de todos)
    const groupITDestinoId = '120363408965534037@g.us';  // Grupo IT destino
    const groupManDestinoId = '120363393791264206@g.us';  // Grupo Mantenimiento destino

    const chat = await message.getChat();

    // Procesar solo si el mensaje es de un grupo
    if (!chat.isGroup) return;

    // Limpiar el mensaje para análisis (eliminar puntuación)
    const cleanedMessage = message.body.toLowerCase().replace(/[.,!?()]/g, '');  // Remueve signos de puntuación
    const words = cleanedMessage.split(/\s+/);  // Divide el mensaje en palabras

    // Verificar si alguna palabra está en el Set de keywords_it
    const itMatch = words.some(word => keywordsIt.has(word));
    const manMatch = words.some(word => keywordsMan.has(word));

    // Verificar que el mensaje sea del grupo de prueba
    if (chat.id._serialized === groupPruebaId) {
        if (itMatch) {
            console.log('🔹 Mensaje contiene palabra clave de IT, reenviando al grupo IT...');
            const targetChat = await client.getChatById(groupITDestinoId);
            await targetChat.sendMessage(message.body);
            console.log('✅ Mensaje reenviado al grupo IT.');
        } else if (manMatch) {
            console.log('🔹 Mensaje contiene palabra clave de Mantenimiento, reenviando al grupo Mantenimiento...');
            const targetChat = await client.getChatById(groupManDestinoId);
            await targetChat.sendMessage(message.body);
            console.log('✅ Mensaje reenviado al grupo Mantenimiento.');
        }
    }
});

// Inicializa el cliente de WhatsApp
client.initialize();
//PRUEBA MAN