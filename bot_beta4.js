const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');  // Para leer archivos

const client = new Client({
    authStrategy: new LocalAuth()
});

// Cargar palabras clave al inicio
let keywords = [];
function loadKeywords() {
    try {
        const data = fs.readFileSync('keywords_it.txt', 'utf8');
        keywords = data.split('\n').map(word => word.trim().toLowerCase()); // Guardar en minúsculas y sin espacios
        console.log('✅ Palabras clave cargadas:', keywords);
    } catch (err) {
        console.error('❌ Error al leer el archivo de palabras clave:', err);
    }
}

// Evento para mostrar el QR en consola
client.on('qr', qr => {
    console.log('🔹 Escanea este QR con WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

// Evento cuando el cliente está listo
client.on('ready', async () => {
    console.log('✅ Bot de WhatsApp conectado y listo.');

    // Cargar las palabras clave al inicio
    loadKeywords();

    // Obtener todos los chats
    const chats = await client.getChats();
    console.log('Chats disponibles:', chats.length);

    // Filtrar solo los chats que son grupos
    const groups = chats.filter(chat => chat.isGroup);
    console.log('Grupos disponibles:', groups.length);

    groups.forEach(group => {
        console.log(`📌 Grupo: ${group.name} - ID: ${group.id._serialized}`);
    });
});

// Evento para recibir y procesar los mensajes
client.on('message', async message => {
    console.log(`📩 Mensaje recibido: "${message.body}"`);

    // ID de los grupos
    const groupITPruebaId = '120363389868056953@g.us';  // ID del grupo "IT prueba"
    const groupBotDestinoId = '120363408965534037@g.us';  // ID del grupo "Bot destino"

    // Normalizar mensaje (minúsculas y sin espacios extra)
    const messageText = message.body.toLowerCase().trim();

    // Verifica si el mensaje contiene alguna palabra clave como palabra completa
    const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'i');  // Expresión regular para palabras exactas

    if (regex.test(messageText)) {
        const chat = await message.getChat();

        // Verifica si el mensaje es del grupo "IT prueba"
        if (chat.id._serialized === groupITPruebaId) {
            console.log('🔹 Mensaje de "IT prueba" contiene una palabra clave, reenviando...');

            // Reenvía el mensaje al grupo "Bot destino"
            const targetChat = await client.getChatById(groupBotDestinoId);
            await targetChat.sendMessage(message.body);
            console.log('✅ Mensaje reenviado al grupo "Bot destino".');
        }
    }
});

// Inicializa el cliente de WhatsApp
client.initialize();

//CHECAR