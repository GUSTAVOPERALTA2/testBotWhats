const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Ruta del directorio de sesión
const sessionPath = '/home/gustavo.peralta/whatsapp-bot/.wwebjs_auth/session/';

// Función de espera
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Inicializar cliente
const client = new Client({
    authStrategy: new LocalAuth()
});

// Verificar y eliminar sesión si es inválida
async function checkAndDeleteSession() {
    try {
        if (fs.existsSync(sessionPath)) {
            console.log('Detectando si la sesión es inválida...');
            await wait(2000);

            try {
                const state = await client.getState();
                if (state !== 'CONNECTED') {
                    console.log('❌ Sesión inválida. Eliminando datos de autenticación...');
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                } else {
                    console.log('✅ Sesión válida. No se elimina.');
                }
            } catch (error) {
                console.log('❌ No se pudo verificar el estado. Eliminando sesión...');
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }
        }
    } catch (err) {
        console.error('Error al gestionar la sesión:', err);
    }
}

// Manejo de eventos
client.on('disconnected', async (reason) => {
    console.log('⚠️ Se perdió la conexión:', reason);
    if (reason === 'NAVIGATION') {
        console.log('Intentando reconectar en 5 segundos...');
        setTimeout(() => client.initialize(), 5000);
    }
});

client.on('auth_failure', () => {
    console.log('⚠️ Fallo de autenticación. Eliminando sesión y reiniciando...');
    fs.rmSync(sessionPath, { recursive: true, force: true });
    setTimeout(() => client.initialize(), 5000);
});

client.on('qr', qr => {
    console.log('Escanea este QR con WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot de WhatsApp conectado y listo.');
});

// Función para reenviar mensajes a los grupos correspondientes
async function forwardMessage(client, message, targetGroupId, category) {
    try {
        const targetChat = await client.getChatById(targetGroupId);
        await targetChat.sendMessage(`Nueva tarea recibida: \n \n*${message.body}*`);
        console.log(`📩 Mensaje reenviado a ${category}: ${message.body}`);

        // Confirmación en el grupo de pruebas
        const groupPruebaId = '120363389868056953@g.us';
        const groupChat = await client.getChatById(groupPruebaId);
        await groupChat.sendMessage(`✅ El mensaje se ha enviado al grupo *${category}*`);
    } catch (error) {
        console.error(`❌ Error al reenviar mensaje a ${category}:`, error.message);
    }
}

// Manejo de mensajes
client.on('message', async (message) => {
    console.log(`📩 Mensaje recibido: "${message.body}"`);

    // Solo procesar mensajes en grupos
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    const groupMappings = {
        'it': '120363408965534037@g.us',
        'mantenimiento': '120363393791264206@g.us',
        'ama': '120363409776076000@g.us'
    };

    for (const [keyword, groupId] of Object.entries(groupMappings)) {
        if (message.body.toLowerCase().includes(keyword)) {
            await forwardMessage(client, message, groupId, keyword.charAt(0).toUpperCase() + keyword.slice(1));
            break;
        }
    }

    // Manejo de confirmaciones de tareas
    if (message.hasQuotedMsg) {
        try {
            const quotedMessage = await message.getQuotedMessage();
            if (quotedMessage.body.startsWith("Nueva tarea recibida: \n")) {
                const taskMessage = quotedMessage.body.replace('Nueva tarea recibida: \n \n', '');
                const confirmationMessage = `✅ La tarea: \n *${taskMessage}* \n ha sido *COMPLETADA*.`;
                await chat.sendMessage(confirmationMessage);

                // Enviar también la confirmación al grupo de pruebas
                const groupPruebaId = '120363389868056953@g.us';
                const groupChat = await client.getChatById(groupPruebaId);
                await groupChat.sendMessage(confirmationMessage);

                console.log(`✅ Confirmación enviada: ${taskMessage}`);
            }
        } catch (error) {
            console.error('❌ Error al procesar confirmación:', error.message);
        }
    }
});

// Iniciar el bot
(async () => {
    await checkAndDeleteSession();
    client.initialize();
})();
//Codigo optimizado