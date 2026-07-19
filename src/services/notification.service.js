import admin from '../firebase.js';

// ===== ENVIAR NOTIFICACIÓN A UN DISPOSITIVO =====
export const enviarNotificacion = async (fcmToken, title, body, data = {}) => {
    console.log('🔵 1. Enviando notificación...');
    console.log('🔵 2. Token:', fcmToken);
    console.log('🔵 3. Título:', title);
    
    if (!admin) {
        console.log('⚠️ Firebase no inicializado. Notificación no enviada.');
        return null;
    }

    if (!fcmToken) {
        console.log('⚠️ Token FCM no proporcionado.');
        return null;
    }

    const message = {
        notification: {
        title: title,
        body: body,
        },
        data: data,
        token: fcmToken,
        android: {
        priority: 'high',
        notification: {
            sound: 'default',
        }
        }
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Notificación enviada exitosamente');
        return response;
    } catch (error) {
        console.error('Error al enviar notificación:', error);
        throw error;
    }
    };

    // ===== OBTENER TOKEN DE UN USUARIO ESPECÍFICO =====
    export const getTokenByUsuario = async (conmysql, idUsuario) => {
    try {
        const [result] = await conmysql.query(
        'SELECT fcm_token FROM usuarios WHERE id_usuario = ? AND fcm_token IS NOT NULL AND fcm_token != ""',
        [idUsuario]
        );
        return result.length > 0 ? result[0].fcm_token : null;
    } catch (error) {
        console.error('Error al obtener token:', error);
        return null;
    }
    };

    // ===== NOTIFICACIONES PRE-DEFINIDAS =====

    // 1. Nueva Orden
    export const notificarNuevaOrden = async (conmysql, orden, cliente, tecnicoId) => {
    const title = '🆕 Nueva orden de trabajo';
    const body = `Orden ${orden.codigo_orden} - Cliente: ${cliente} - Equipo: ${orden.tipo_equipo}`;
    const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
    
    const token = await getTokenByUsuario(conmysql, tecnicoId);
    if (token) {
        return await enviarNotificacion(token, title, body, data);
    }
    console.log(`⚠️ No hay token para el técnico ${tecnicoId}`);
    return null;
    };

    // 2. Cambio de Estado
    export const notificarCambioEstado = async (conmysql, orden, cliente, nuevoEstado, tecnicoId) => {
    const title = '📋 Orden actualizada';
    const body = `Orden ${orden.codigo_orden} cambió a "${nuevoEstado}"`;
    const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
    
    const token = await getTokenByUsuario(conmysql, tecnicoId);
    if (token) {
        return await enviarNotificacion(token, title, body, data);
    }
    return null;
    };

    // 3. Asignación de Técnico
    export const notificarAsignacionTecnico = async (conmysql, orden, cliente, tecnicoId) => {
    const title = '👤 Nueva asignación';
    const body = `Orden ${orden.codigo_orden} - Cliente: ${cliente}`;
    const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
    
    const token = await getTokenByUsuario(conmysql, tecnicoId);
    if (token) {
        return await enviarNotificacion(token, title, body, data);
    }
    return null;
    };

    // 4. Solicitud de Repuesto (stock bajo)
    export const notificarStockBajo = async (conmysql, repuesto, stock, tecnicoNombre) => {
    const title = '📦 Solicitud de repuesto';
    const body = `Repuesto "${repuesto}" - Stock actual: ${stock} - Técnico: ${tecnicoNombre}`;
    const data = { tipo: 'stock_bajo', id_repuesto: String(repuesto.id_repuesto || 0) };
    
    const [admins] = await conmysql.query(
        'SELECT fcm_token FROM usuarios WHERE rol = "ADMIN" AND fcm_token IS NOT NULL AND fcm_token != ""'
    );
    
    for (const admin of admins) {
        await enviarNotificacion(admin.fcm_token, title, body, data);
    }
    return null;
    };

    // 5. Nuevo Abono
    export const notificarNuevoAbono = async (conmysql, orden, monto, cliente) => {
    const title = '💰 Nuevo abono registrado';
    const body = `Orden ${orden.codigo_orden} - Abono: $${monto} - Cliente: ${cliente}`;
    const data = { tipo: 'orden', id_orden: String(orden.id_orden) };
    
    const [admins] = await conmysql.query(
        'SELECT fcm_token FROM usuarios WHERE rol = "ADMIN" AND fcm_token IS NOT NULL AND fcm_token != ""'
    );
    
    for (const admin of admins) {
        await enviarNotificacion(admin.fcm_token, title, body, data);
    }
    return null;
    };

    // 6. Factura Generada
    export const notificarFacturaGenerada = async (conmysql, orden, total, cliente, numeroFactura) => {
    const title = '📄 Factura generada';
    const body = `Orden ${orden.codigo_orden} - Total: $${total} - Cliente: ${cliente}`;
    const data = { tipo: 'factura', id_orden: String(orden.id_orden) };
    
    const [admins] = await conmysql.query(
        'SELECT fcm_token FROM usuarios WHERE rol = "ADMIN" AND fcm_token IS NOT NULL AND fcm_token != ""'
    );
    
    for (const admin of admins) {
        await enviarNotificacion(admin.fcm_token, title, body, data);
    }
    return null;
};