client.on('message', async message => {
    console.log(`📩 Mensaje recibido: "${message.body}"`);

    const groupITPruebaId = '120363389868056953@g.us';  
    const groupBotDestinoId = '120363408965534037@g.us';  
    const groupMantenimientoId = '120363393791264206@g.us';  
    const groupAmaId = '120363409776076000@g.us'; 

    const chat = await message.getChat();
    if (!chat.id._serialized.endsWith('@g.us')) return;

    // Primer bloque para manejar palabras clave
    const cleanedMessage = message.body.toLowerCase().replace(/[.,!?()]/g, '');
    if (!cleanedMessage.trim()) return;

    const words = cleanedMessage.split(/\s+/);

    let foundIT = false, foundMan = false, foundAma = false;
    for (let word of words) {
        if (keywordsIt.has(word)) foundIT = true;
        if (keywordsMan.has(word)) foundMan = true;
        if (keywordsAma.has(word)) foundAma = true;
    }

    let media = null;
    if (message.hasMedia && (foundIT || foundMan || foundAma)) {
        media = await message.downloadMedia();
    }

    async function forwardMessage(targetGroupId, category) {
        const targetChat = await client.getChatById(targetGroupId);
        const forwardedMessage = await targetChat.sendMessage(`⏳ Nueva tarea recibida: \n"${message.body}"`);
        if (media) await targetChat.sendMessage(media);
        console.log(`📤 Mensaje reenviado a ${category}: ${message.body}`);
    }

    if (foundIT) await forwardMessage(groupBotDestinoId, "IT");
    if (foundMan) await forwardMessage(groupMantenimientoId, "Mantenimiento");
    if (foundAma) await forwardMessage(groupAmaId, "Ama");

    // Segundo bloque para manejar confirmación de tarea
    if (message.hasQuotedMsg) {
        const quotedMessage = await message.getQuotedMessage();
        if (quotedMessage.body.startsWith("⏳ Nueva tarea recibida")) {
            // Eliminamos el prefijo "⏳ Nueva tarea recibida" y ponemos la tarea en negritas
            const taskMessage = quotedMessage.body.replace('⏳ Nueva tarea recibida: \n', '');
            const confirmationMessage = `La tarea **${taskMessage}** ha sido completada. ✅`;
            await chat.sendMessage(confirmationMessage);
            console.log(`📢 Confirmación recibida en ${chat.name}: ${taskMessage}`);
        }
    }
});
//Confirmacion avanzada de tareas 2