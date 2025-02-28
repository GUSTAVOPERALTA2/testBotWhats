const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Cargar las palabras clave desde los archivos de texto
const keywordsMan = fs.readFileSync('keywords_man.txt', 'utf-8').split('\n').map(keyword => keyword.trim().toLowerCase());
const keywordsIt = fs.readFileSync('keywords_it.txt', 'utf-8').split('\n').map(keyword => keyword.trim().toLowerCase());

const client = new Client({
    authStrategy: new LocalAuth()
});

// Evento para mostrar el QR en consola
client.on('qr', qr => {
    console.log('🔹 Escanea este QR con WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

// Evento cuando el cliente está listo
client.on('ready', async () => {
    console.log('✅ Bot de WhatsApp conectado y listo.');

    // Obtener todos los chats
    const chats = await client.getChats();
    console.log('Chats disponibles:', chats);

    if (chats && chats.length > 0) {
        // Mostrar todos los chats (grupos e individuales)
        chats.forEach(chat => {
            console.log(`Chat encontrado: ${chat.name || chat.id._serialized}, ID: ${chat.id._serialized}`);
        });
    } else {
        console.log('❌ No se encontraron chats');
    }
});

// Evento para recibir y procesar los mensajes
client.on('message', async message => {
    console.log(`📩 Mensaje recibido: ${message.body}`);

    // Convertir el mensaje a minúsculas para comparación
    const messageText = message.body.toLowerCase();

    // Filtrar los chats que contienen las palabras clave
    let targetGroupId = null;

    // Verificar si el mensaje contiene palabras clave para mantenimiento
    if (keywordsMan.some(keyword => messageText.includes(keyword))) {
        targetGroupId = '120363393791264206@g.us'; // ID del grupo "Mantenimiento"
    }
    
    // Verificar si el mensaje contiene palabras clave para IT
    else if (keywordsIt.some(keyword => messageText.includes(keyword))) {
        targetGroupId = '120363389868056953@g.us'; // ID del grupo "Prueba general"
    }

    // Si se detectó un grupo de destino, reenviar el mensaje
    if (targetGroupId) {
        console.log('📤 Reenviando mensaje...');

        // Reenvía el mensaje al grupo de destino
        await message.forward(targetGroupId);
        console.log('✅ Mensaje reenviado al grupo de destino.');
    }
});

// Inicializa el cliente de WhatsApp
client.initialize();
