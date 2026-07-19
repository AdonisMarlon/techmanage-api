import { conmysql } from '../db.js';
import { notificarNuevoCliente, notificarClienteEditado } from '../services/notification.service.js';

// ============================================================
// OBTENER TODOS LOS CLIENTES
// ============================================================
export const getClientes = async (req, res) => {
    try {
        const [result] = await conmysql.query('SELECT * FROM clientes ORDER BY fecha_registro DESC');
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getClientes:', error.message);
        res.status(500).json({ error: 'Error al obtener los clientes' });
    }
};

// ============================================================
// OBTENER CLIENTE POR ID
// ============================================================
export const getClienteById = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query('SELECT * FROM clientes WHERE id_cliente = ?', [id]);
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json(result[0]);
    } catch (error) {
        console.error('[ERROR] getClienteById:', error.message);
        res.status(500).json({ error: 'Error al obtener el cliente' });
    }
};

// ============================================================
// CREAR CLIENTE
// - Notifica al admin cuando cualquier usuario crea un cliente
// ============================================================
export const crearCliente = async (req, res) => {
    try {
        const { cedula, nombre_completo, telefono, correo, direccion } = req.body;
        
        const [result] = await conmysql.query(
            'INSERT INTO clientes (cedula, nombre_completo, telefono, correo, direccion) VALUES (?, ?, ?, ?, ?)',
            [cedula, nombre_completo, telefono, correo, direccion]
        );

        // NOTIFICACIÓN: Nuevo cliente creado
        try {
            const usuarioNombre = req.user?.nombre || 'Tecnico';
            await notificarNuevoCliente(conmysql, { nombre_completo, cedula }, usuarioNombre);
            console.log('[FCM] Notificacion de nuevo cliente enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarNuevoCliente:', notifError.message);
        }

        res.status(201).json({ 
            mensaje: 'Cliente registrado con éxito', 
            id_cliente: result.insertId 
        });
    } catch (error) {
        console.error('[ERROR] crearCliente:', error.message);
        res.status(500).json({ error: 'Error al registrar el cliente. Verifica que la cédula no esté duplicada.' });
    }
};

// ============================================================
// ACTUALIZAR CLIENTE
// - Notifica al admin cuando cualquier usuario edita un cliente
// ============================================================
export const actualizarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre_completo, telefono, correo, direccion } = req.body;
        
        // Obtener datos anteriores para la notificación
        const [clienteAnterior] = await conmysql.query(
            'SELECT nombre_completo, cedula FROM clientes WHERE id_cliente = ?',
            [id]
        );

        await conmysql.query(
            'UPDATE clientes SET nombre_completo = ?, telefono = ?, correo = ?, direccion = ? WHERE id_cliente = ?',
            [nombre_completo, telefono, correo, direccion, id]
        );

        // NOTIFICACIÓN: Cliente editado
        try {
            const usuarioNombre = req.user?.nombre || 'Tecnico';
            const cedula = clienteAnterior[0]?.cedula || 'N/A';
            await notificarClienteEditado(conmysql, { nombre_completo, cedula }, usuarioNombre);
            console.log('[FCM] Notificacion de cliente editado enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarClienteEditado:', notifError.message);
        }

        res.json({ mensaje: 'Cliente actualizado con éxito' });
    } catch (error) {
        console.error('[ERROR] actualizarCliente:', error.message);
        res.status(500).json({ error: 'Error al actualizar el cliente' });
    }
};

// ============================================================
// BUSCAR CLIENTES
// ============================================================
export const buscarClientes = async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim() === '') {
            return res.json([]);
        }
        
        const termino = `%${q.trim()}%`;
        const [result] = await conmysql.query(
            `SELECT * FROM clientes 
            WHERE cedula LIKE ? 
            OR nombre_completo LIKE ? 
            OR telefono LIKE ?
            ORDER BY nombre_completo ASC
            LIMIT 20`,
            [termino, termino, termino]
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] buscarClientes:', error.message);
        res.status(500).json({ error: 'Error al buscar clientes' });
    }
};

// ============================================================
// ELIMINAR CLIENTE (SOLO ADMIN)
// ============================================================
export const eliminarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que el cliente no tenga órdenes activas
        const [ordenes] = await conmysql.query(
            'SELECT COUNT(*) as total FROM ordenes_trabajo WHERE id_cliente = ?',
            [id]
        );
        
        if (ordenes[0].total > 0) {
            return res.status(400).json({ 
                error: `No se puede eliminar. El cliente tiene ${ordenes[0].total} órdenes asociadas.` 
            });
        }

        const [result] = await conmysql.query(
            'DELETE FROM clientes WHERE id_cliente = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json({ mensaje: 'Cliente eliminado con éxito' });
    } catch (error) {
        console.error('[ERROR] eliminarCliente:', error.message);
        res.status(500).json({ error: 'Error al eliminar el cliente' });
    }
};