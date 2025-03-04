if (isConfirmation && [groupBotDestinoId, groupMantenimientoId, groupAmaId].includes(chat.id._serialized)) {
    console.log("Confirmación detectada, enviando al grupo principal...");
    try {
        const groupChat = await client.getChatById(groupPrincipalId);
        await groupChat.sendMessage(`La tarea:\n\n${message.body}\n\nHa sido completada.`);
    } catch (error) {
        console.error("Error al enviar mensaje de confirmación:", error);
    }
}


//Reinicio bien