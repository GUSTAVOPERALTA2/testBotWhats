const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Definir los IDs de los grupos
const GROUP_PRUEBA_GENERAL = '120363389868056953@g.us';  // Prueba general
const GROUP_DESTINO_IT = '120363408965534037@g.us'; // IT Destino
const GROUP_DESTINO_MANTENIMIENTO = '120363393791264206@g.us';  // Mantenimiento Destino

// Función para cargar palabras clave desde un archivo
const loadKeywords = (filename) => {
    try {
        return fs.readFileSync(filename, 'utf8')
            .split('\n')
            .map(word => word.trim())
            .filter(word => word.length > 0);
    } catch (err) {
        console.error(`❌ Error al leer ${filename}:`, err);
        return [];
    }
};

// Cargar palabras clave desde los archivos
let keywords_it = loadKeywords('keywords_it.txt');
let keywords_man = loadKeywords('keywords_man.txt');

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
    console.log('Grupos disponibles:');

    // Filtrar solo los chats que son grupos
    const groups = chats.filter(chat => chat.isGroup);

    if (groups.length === 0) {
        console.log('❌ No se encontraron grupos');
    } else {
        groups.forEach(group => {
            console.log(`Grupo encontrado: ${group.name}, ID: ${group.id._serialized}`);
        });
    }
});

// Evento para recibir y procesar los mensajes
client.on('message', async message => {
    console.log(`📩 Mensaje recibido: ${message.body}`);

    const chat = await message.getChat();

    // Verifica si es un grupo
    if (chat.isGroup) {
        // Reenviar mensajes desde "Prueba general" al grupo "IT Destino"
        if (chat.id._serialized === GROUP_PRUEBA_GENERAL && keywords_it.some(word => message.body.toLowerCase().includes(word.toLowerCase()))) {
            console.log('📤 Reenviando mensaje desde Prueba general a IT Destino...');
            await message.forward(GROUP_DESTINO_IT);
            console.log('✅ Mensaje reenviado.');
        }

        // Reenviar mensajes con palabras clave de mantenimiento a "Mantenimiento Destino"
        if (keywords_man.some(word => message.body.toLowerCase().includes(word.toLowerCase()))) {
            console.log('📤 Reenviando mensaje a Mantenimiento Destino...');
            await message.forward(GROUP_DESTINO_MANTENIMIENTO);
            console.log('✅ Mensaje reenviado.');
        }
    }
});

// Inicializa el cliente de WhatsApp
client.initialize();
