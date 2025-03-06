const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');  

const client = new Client({
    authStrategy: new LocalAuth()
});

let keywordsIt = new Set();
let keywordsMan = new Set();
let keywordsAma = new Set();
let confirmationKeywords = [];

function loadKeywords() {
    try {
        const dataIt = fs.readFileSync('keywords_it.txt', 'utf8');
        keywordsIt = new Set(dataIt.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('Palabras clave IT cargadas:', [...keywordsIt]);

        const dataMan = fs.readFileSync('keywords_man.txt', 'utf8');
        keywordsMan = new Set(dataMan.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('Palabras clave Man cargadas:', [...keywordsMan]);

        const dataAma = fs.readFileSync('keywords_ama.txt', 'utf8');
        keywordsAma = new Set(dataAma.split('\n').map(word => word.trim().toLowerCase()).filter(word => word));
        console.log('Palabras clave Ama cargadas:', [...keywordsAma]);

        const confirmData = fs.readFileSync('keywords_confirm.txt', 'utf8');
        confirmationKeywords = confirmData.split('\n').map(phrase => phrase.trim().toLowerCase()).filter(phrase => phrase);
        console.log('Frases de confirmación cargadas:', confirmationKeywords);
        
    } catch (err) {
        console.error('Error al leer los archivos de palabras clave:', err);
    }
}

client.on('qr', qr => {
    console.log('Escanea este QR con WhatsApp Web:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Bot de WhatsApp conectado y listo.');
    loadKeywords();

    const chats = await client.getChats();
    console.log(`Chats disponibles: ${chats.length}`);

    const groups = chats.filter(chat => chat.id._serialized.endsWith('@g.us'));
    console.log(`Grupos disponibles: ${groups.length}`);
    groups.forEach(group => {
        console.log(`Grupo: ${group.name} - ID: ${group.id._serialized}`);
    });
});

client.on('disconnected', async (reason) => {
    console.log(`Bot desconectado: ${reason}`);

    try {
        await client.destroy();
        console.log('Sesión cerrada correctamente tras desconexión.');
    } catch (error) {
        console.error('Error al intentar cerrar la sesión tras desconexión:', error);
    }

    console.log('Vuelve a iniciar el bot para escanear el código QR.');
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log('Deteniendo el bot de WhatsApp...');
    if (client) {
        try {
            await client.destroy();
            console.log('Sesión de WhatsApp cerrada correctamente.');
        } catch (error) {
            console.error('Error al cerrar la sesión de WhatsApp:', error);
        }
    }
    process.exit(0);
});

client.initialize();