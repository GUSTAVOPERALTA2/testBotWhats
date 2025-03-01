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
        if (media) await targetChatIT.sendMessage(media);

        // Ahora monitoreamos las respuestas en IT
        client.on('message', async (responseMessage) => {
            if (responseMessage.referenceMessage && responseMessage.referenceMessage.id === sentMessage.id) {
                console.log(`📝 Respuesta recibida al mensaje "${message.body}": "${responseMessage.body}"`);
                // Aquí podrías agregar lógica para manejar las respuestas si lo necesitas
            }
        });
    }
});
//REPLY
