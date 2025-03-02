const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

// Ruta de la sesión
const sessionPath = '/home/gustavo.peralta/whatsapp-bot/.wwebjs_auth/session';

// Crear una nueva instancia del cliente con la autenticación local
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "default", // Puedes usar un nombre único por cada cliente si lo deseas
        dataPath: path.join(sessionPath, 'Default') // Ruta de los archivos de sesión
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Manejo del evento 'authenticated' (cuando la autenticación es exitosa)
client.on('authenticated', () => {
    console.log('Bot de WhatsApp conectado y listo.');
    // Cargar palabras clave y frases de confirmación como antes
    loadKeywordsAndConfirmations();
});

// Manejo del evento 'auth_failure' (cuando la autenticación falla)
client.on('auth_failure', (message) => {
    console.log('Autenticación fallida: ', message);
    // Si ocurre un error de autenticación, regenerar la sesión
    regenerateSession();
});

// Manejo del evento 'qr' (cuando se debe escanear un QR)
client.on('qr', (qr) => {
    console.log('Escanea este QR con WhatsApp Web:');
    console.log(qr);
});

// Manejo del evento 'ready' (cuando el cliente está listo para usar)
client.on('ready', () => {
    console.log('Bot de WhatsApp conectado y listo.');
});

// Manejo del cierre de sesión en WhatsApp Web desde la app
client.on('disconnected', async (reason) => {
    console.log('Sesión desconectada:', reason);
    // Si se cierra sesión desde la app, regenerar la sesión
    if (reason === 'ConnectionClosed') {
        regenerateSession();
    }
});

// Función para regenerar la sesión
function regenerateSession() {
    console.log('Regenerando la sesión...');
    
    // Verifica si el directorio de sesión existe y lo limpia
    if (fs.existsSync(sessionPath)) {
        try {
            // Elimina el directorio de sesión y su contenido
            fs.rmdirSync(sessionPath, { recursive: true });
            console.log('Sesión eliminada correctamente.');
        } catch (err) {
            console.error('Error al eliminar la sesión:', err);
        }
    }
    
    // Inicia un nuevo cliente con la nueva sesión
    client.initialize();
}

// Cargar las palabras clave y frases de confirmación
function loadKeywordsAndConfirmations() {
    console.log('Palabras clave IT cargadas:', ['television', 'tv', 'tele']);
    console.log('Palabras clave Man cargadas:', ['mantenimiento', 'regadera', 'agua']);
    console.log('Palabras clave Ama cargadas:', ['limpieza', 'sofa', 'cama']);
    console.log('Frases de confirmación cargadas:', ['listo', 'requerimiento realizado']);
}

// Función para manejar los mensajes y reenviarlos según la palabra clave
client.on('message', async (message) => {
    const keywordsIT = ['television', 'tv', 'tele', 'canales', 'canal', 'control', 'controles', 'internet', 'ethernet', 'wifi', 'conexion', 'red', 'redes', 'computadora', 'micros', 'laptop', 'opera', 'interfaces', 'ifc', 'cables', 'hdmi', 'adaptador', 'adaptadores', 'cargador', 'iluminacion', 'luces', 'luz', 'programacion', 'programa', 'memoria', 'israel', 'omaly', 'gustavo', 'sistemas', 'accesos', 'excel', 'powerpoint', 'word', 'microsoft', 'office', 'telefonos', 'telefono', 'vpn', 'vlan', 'router', 'antena', 'switch', 'sonido', 'bocina', 'audio', 'innspire'];
    const keywordsMan = ['mantenimiento', 'regadera', 'agua'];
    const keywordsAma = ['limpieza', 'sofa', 'cama', 'camaristaox'];
    const confirmationPhrases = ['listo', 'requerimiento realizado'];

    const groups = {
        IT: 'grupo-it',
        Man: 'grupo-man',
        Ama: 'grupo-ama'
    };

    const messageText = message.body.toLowerCase();

    // Buscar coincidencia con las palabras clave
    let targetGroup = null;

    if (keywordsIT.some(keyword => messageText.includes(keyword))) {
        targetGroup = groups.IT;
    } else if (keywordsMan.some(keyword => messageText.includes(keyword))) {
        targetGroup = groups.Man;
    } else if (keywordsAma.some(keyword => messageText.includes(keyword))) {
        targetGroup = groups.Ama;
    }

    // Si se encontró un grupo de destino, reenviar el mensaje
    if (targetGroup) {
        await message.forwardTo(targetGroup);
        // Confirmar en el grupo principal que el mensaje fue reenviado
        const chat = await client.getChatById('grupo-prueba');
        chat.sendMessage(`El mensaje fue reenviado al grupo: ${targetGroup}`);
    }
});

// Inicializar el cliente
client.initialize();
//Codigo para cerrar sesion segura