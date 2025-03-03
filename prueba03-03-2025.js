const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const sessionPath = '/home/gustavo.peralta/whatsapp-bot/.wwebjs_auth/session/';
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const client = new Client({
    authStrategy: new LocalAuth()
});

async function checkAndDeleteSession() {
    if (fs.existsSync(sessionPath)) {
        console.log('🔍 Verificando sesión...');
        await wait(2000);
        try {
            const state = await client.getState();
            if (state !== 'CONNECTED') {
                console.log('❌ Sesión inválida. Eliminando datos de autenticación...');
                fs.rmSync(sessionPath, { recursive: true, force: true });
            } else {
                console.log('✅ Sesión válida.');
            }
        } catch {
            console.log('⚠️ No se pudo verificar el estado. Eliminando sesión...');
            fs.rmSync(sessionPath, { recursive: true, force: true });
        }
    }
}

client.on('disconnected', async (reason) => {
    console.log('⚠️ Se perdió la conexión:', reason);
    if (reason === 'NAVIGATION') {
        console.log('🔄 Intentando reconectar en 5 segundos...');
        setTimeout(() => client.initialize(), 5000);
    }
});

client.on('auth_failure', () => {
    console.log('❌ Fallo de autenticación. Eliminando sesión...');
    fs.rmSync(sessionPath, { recursive: true, force: true });
    setTimeout(() => client.initialize(), 5000);
});

client.on('qr', qr => {
    console.log('📸 Escanea este QR con WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot de WhatsApp conectado y listo.');
});

const groupMappings = {
    'it': '120363408965534037@g.us',
    'mantenimiento': '120363393791264206@g.us',
    'ama': '120363409776076000@g.us'
};

async function forwardMessage(client, message, targetGroupId, category) {
    try {
        console.log(`📩 Intentando reenviar mensaje a ${category}...`);
        const targetChat = await client.getChatById(targetGroupId);
        await targetChat.sendMessage(`Nueva tarea recibida: \n\n*${message.body}*`);
        console.log(`✅ Mensaje enviado a ${category}.`);

        const groupPruebaId = '120363389868056953@g.us';
        const groupChat = await client.getChatById(groupPruebaId);
        await groupChat.sendMessage(`✅ El mensaje se envió al grupo *${category}*.`);
    } catch (error) {
        console.error(`❌ Error al enviar mensaje a ${category}:`, error.message);
    }
}

client.on('message', async (message) => {
    console.log(`📨 Mensaje recibido: "${message.body}"`);

    const chat = await message.getChat();
    if (!chat.isGroup) {
        console.log('ℹ️ Mensaje ignorado (no es de un grupo).');
        return;
    }

    let found = false;
    for (const [keyword, groupId] of Object.entries(groupMappings)) {
        if (message.body.toLowerCase().includes(keyword)) {
            console.log(`🔍 Palabra clave detectada: "${keyword}"`);
            await forwardMessage(client, message, groupId, keyword.charAt(0).toUpperCase() + keyword.slice(1));
            found = true;
            break;
        }
    }

    if (!found) {
        console.log('❌ No se detectó ninguna palabra clave.');
    }

    if (message.hasQuotedMsg) {
        try {
            const quotedMessage = await message.getQuotedMessage();
            if (quotedMessage.body.startsWith("Nueva tarea recibida: \n")) {
                const taskMessage = quotedMessage.body.replace('Nueva tarea recibida: \n\n', '');
                const confirmationMessage = `✅ La tarea: \n *${taskMessage}* \n ha sido *COMPLETADA*.`;
                await chat.sendMessage(confirmationMessage);

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

(async () => {
    await checkAndDeleteSession();
    client.initialize();
})();
//Manejo de errores 2