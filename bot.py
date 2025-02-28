from twilio.rest import Client

# Tus credenciales de Twilio
account_sid = 'your_account_sid'
auth_token = 'your_auth_token'
client = Client(account_sid, auth_token)

# Enviar mensaje de WhatsApp
message = client.messages.create(
    body="¡Hola! Este es un mensaje de prueba desde Twilio.",
    from_='whatsapp:+14155238886',  # Tu número de Twilio (con prefijo whatsapp:)
    to='whatsapp:+521XXXXXXXXXX'  # El número de destino (con prefijo whatsapp:)
)

print(message.sid)  # Muestra el SID del