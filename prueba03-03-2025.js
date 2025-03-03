const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Ruta del directorio de sesión
const sessionPath = '/home/gustavo.peralta/whatsapp-bot/.wwebjs_auth/session/';

async function checkAndDeleteSession() {
    try {
        if (fs.existsSync(sessionPath)) {
            console.log('Detectando si la sesión es inválida...');
            await wait(2000);
            
            client.getState().then(state => {
                if (state !== 'CONNECTED') {
                    console.log('❌ Sesión inválida. Eliminando datos de autenticación...');
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                } else {
                    console.log('✅ Sesión válida. No se elimina.');
                }
            }).catch(() => {
                console.log('❌ No se pudo verificar el estado. Eliminando sesión...');
                fs.rmSync(sessionPath, { recursive: true, force: true });
            });
        }
    } catch (err) {
        console.error('Error al gestionar la sesión:', err);
    }
}

// Función de espera
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

checkAndDeleteSession();  // Verifica la sesión antes de iniciar el bot

const client = new Client({
    authStrategy: new LocalAuth()
});

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

client.on('ready', async () => {
    console.log('Bot de WhatsApp conectado y listo.');
});

client.on('message', async message => {
    console.log(`Mensaje recibido: "${message.body}"`);
    
    const groupPruebaId = '120363389868056953@g.us';

    const chat = await message.getChat();
    if (!chat.id._serialized.endsWith('@g.us')) return;

    async function forwardMessage(targetGroupId, category) {
        const targetChat = await client.getChatById(targetGroupId);
        await targetChat.sendMessage(`Nueva tarea recibida: \n \n*${message.body}*`);
        console.log(`Mensaje reenviado a ${category}: ${message.body}`);

        await client.getChatById(groupPruebaId).then(groupChat => {
            groupChat.sendMessage(`El mensaje se ha enviado al grupo *${category}*`);
        });
    }

    if (message.body.toLowerCase().includes('it')) await forwardMessage('120363408965534037@g.us', "IT");
    if (message.body.toLowerCase().includes('mantenimiento')) await forwardMessage('120363393791264206@g.us', "Mantenimiento");
    if (message.body.toLowerCase().includes('ama')) await forwardMessage('120363409776076000@g.us', "Ama");

    if (message.hasQuotedMsg) {
        const quotedMessage = await message.getQuotedMessage();
        if (quotedMessage.body.startsWith("Nueva tarea recibida: \n")) {
            const taskMessage = quotedMessage.body.replace('Nueva tarea recibida: \n \n', '');
            const confirmationMessage = `La tarea: \n ${taskMessage} \n esta *COMPLETADA*.`; 
            await chat.sendMessage(confirmationMessage);
            await client.getChatById(groupPruebaId).then(groupChat => {
                groupChat.sendMessage(confirmationMessage);
            });
            console.log(`Confirmación recibida en ${chat.name}: ${taskMessage}`);
        }
    }
});

client.initialize();

//Solucion de sesion1