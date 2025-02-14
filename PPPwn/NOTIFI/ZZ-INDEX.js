const supportedFirmwares = ["1.00", "1.02", "1.05", "1.10", "1.11", "1.12", "1.13", "1.14", "2.00", "2.20", "2.25", "2.26", "2.30", "2.50", "2.70", "3.00", "3.10", "3.20", "3.21", "4.00", "4.02", "4.03", "4.50", "4.51", "5.00", "5.02", "5.10", "5.50"];
const fw_idx = navigator.userAgent.indexOf('PlayStation; PlayStation 5/') + 27;
const fw_str = navigator.userAgent.substring(fw_idx, fw_idx + 4);
document.getElementById("current-fw").innerHTML = "[/] System Software: " + fw_str;
document.getElementById("current-ip").innerHTML = "[/] Address: " + window.location.hostname;

// Función para mostrar la alerta temporal con un icono
function showTemporaryAlert(message, imageUrl, callback) {
    // Crear el div para la alerta
    let alertBox = document.createElement('div');
    alertBox.style.position = 'fixed';
    alertBox.style.top = '80px'; // Fija la posición vertical
    alertBox.style.right = '-350px'; // Inicia fuera de la pantalla a la derecha
    alertBox.style.backgroundColor = 'green'; // Color de fondo verde
    alertBox.style.color = 'white'; // Color del texto blanco
    alertBox.style.padding = '15px 30px'; // Aumentar el padding para mayor tamaño
    alertBox.style.borderRadius = '5px';
    alertBox.style.zIndex = '1000';
    alertBox.style.textAlign = 'left'; // Alinear el texto a la izquierda
    alertBox.style.transition = 'right 0.5s ease-out'; // Transición suave para el deslizamiento
    alertBox.style.fontSize = '18px'; // Aumentar el tamaño de la fuente
    alertBox.style.width = '250px'; // Establecer un ancho fijo para la notificación
    alertBox.style.display = 'flex'; // Usar flexbox para alinear el icono y el texto
    alertBox.style.alignItems = 'center'; // Centrar verticalmente

    // Crear el elemento de la imagen
    let icon = document.createElement('img');
    icon.src = imageUrl; // URL de la imagen para el icono
    icon.style.width = '44px'; // Tamaño del icono
    icon.style.height = '44px';
    icon.style.marginRight = '7px'; // Espacio entre el icono y el texto

    // Crear el elemento de texto
    let text = document.createElement('span');
    text.innerText = message;

    // Añadir la imagen y el texto al alertBox
    alertBox.appendChild(icon);
    alertBox.appendChild(text);

    // Añadir la alerta al cuerpo
    document.body.appendChild(alertBox);

    // Desplazar la alerta hacia su posición final
    setTimeout(() => {
        alertBox.style.right = '20px'; // Se mantiene en el borde derecho con 20px de margen
    }, 30); // Breve retardo para activar la animación

    // Después de 5 segundos (5000ms) remover la alerta
    setTimeout(() => {
        alertBox.remove(); // Remover la alerta
        if (callback) callback(); // Llamar al callback si se proporciona
    }, 5000);
}

// Iniciar el flujo de notificaciones después de un retraso de 60000 ms (1 minuto)
setTimeout(() => {
    showNotifications();
}, 4000);

function showNotifications() {
    // Mostrar el mensaje de bienvenida primero con un icono personalizado
    showTemporaryAlert(`Welcome to Start center`, '/ICONS/welcome.png', () => {
        // Mostrar la notificación de firmware con un icono personalizado
        showTemporaryAlert(`System Software: ${fw_str}`, '/ICONS/setting.png', () => {
            // Mostrar la dirección IP con un icono personalizado
            showTemporaryAlert(`Address: ${window.location.hostname}`, '/ICONS/setting.png', () => {
                // Verificar el firmware con un icono personalizado si no es compatible
                if (!supportedFirmwares.includes(fw_str)) {
                    showTemporaryAlert(`This firmware (${fw_str}) is not supported.`, '/ICONS/setting.png');
                    throw new Error(`Firmware ${fw_str} is not supported.`);
                }
            });
        });
    });
}

