const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');  // Necesario instalar 'uuid'

const client = new Client({
    authStrategy: new LocalAuth()
});

// Diccionario para rastrear mensajes enviados
let sentMessages = new Map();

client.on('qr', qr => {
    console.log('🔹 Escanea este QR con WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ Bot de WhatsApp conectado y listo.');
});

client.on('message', async message => {
    console.log(`📩 Mensaje recibido en "${message.from}": "${message.body}"`);

    const groupITPruebaId = '120363389868056953@g.us';  
    const groupBotDestinoId = '120363408965534037@g.us';  

    const chat = await message.getChat();

    if (!chat.isGroup) return;
    if (chat.id._serialized !== groupITPruebaId) return;

    // Generar un ID único para rastrear el mensaje
    const messageId = uuidv4();  
    const messageContent = `${message.body}\n[ID: ${messageId}]`;

    // Enviar mensaje al grupo destino con el ID
    const targetChatIT = await client.getChatById(groupBotDestinoId);
    const sentMessage = await targetChatIT.sendMessage(messageContent);

    // Guardar el mensaje en el diccionario con su ID
    sentMessages.set(sentMessage.id._serialized, messageId);
    console.log(`🔹 Mensaje enviado a IT con ID: ${messageId}`);
});

// 🔍 Evento para detectar respuestas
client.on('message_create', async responseMessage => {
    const chat = await responseMessage.getChat();

    if (!chat.isGroup) return; // Solo rastrear en grupos

    console.log(`📥 Posible respuesta en "${chat.name}": "${responseMessage.body}"`);

    // Revisar si la respuesta contiene algún ID de mensaje enviado
    for (let [sentMsgId, originalID] of sentMessages) {
        if (responseMessage.body.includes(originalID)) {
            console.log(`✅ Respuesta detectada al mensaje con ID ${originalID}: "${responseMessage.body}"`);
        }
    }
});

client.initialize();
//respuestas2