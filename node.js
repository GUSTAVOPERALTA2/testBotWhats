client.on('disconnected', async (reason) => {
    log('warn', `El cliente se desconectó: ${reason}`);
    if (reason === 'LOGOUT') {
      log('warn', 'Cierre de sesión desde el teléfono detectado. Limpiando sesión en Firestore y reiniciando QR.');
      await clearInvalidSession();
      try {
        if (client) {
          await client.destroy().catch((err) => log('error', 'Error en destroy (LOGOUT):', err));
        }
      } catch (err) {
        log('error', 'Error al destruir el cliente (LOGOUT):', err);
      }
      // Reinicializamos el cliente para que se solicite un nuevo QR, sin matar el proceso
      initializeBot();
    } else {
      log('warn', 'Desconexión inesperada, reiniciando cliente.');
      try {
        if (client) {
          await client.destroy().catch((err) => log('error', 'Error en destroy (desconexión inesperada):', err));
        }
      } catch (err) {
        log('error', 'Error al destruir el cliente (desconexión inesperada):', err);
      }
      initializeBot();
    }
  });
  
  client.on('error', async (error) => {
    log('error', 'Error detectado en Puppeteer:', error);
    // Si se detecta el error de "Execution context was destroyed", se reinicializa el cliente
    try {
      if (client) {
        await client.destroy().catch((err) => log('error', 'Error en destroy (error):', err));
      }
    } catch (err) {
      log('error', 'Error al destruir el cliente (error):', err);
    }
    initializeBot();
  });

  //cierre nuevo
  