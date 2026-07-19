import { conmysql } from '../db.js';
import { notificarSolicitudServicio } from '../services/notification.service.js';

// ============================================================
// OBTENER TODOS LOS SERVICIOS
// ============================================================
export const getServicios = async (req, res) => {
    try {
        const [result] = await conmysql.query('SELECT * FROM servicios ORDER BY nombre ASC');
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getServicios:', error.message);
        res.status(500).json({ error: 'Error al obtener los servicios' });
    }
};

// ============================================================
// OBTENER SERVICIO POR ID
// ============================================================
export const getServicioById = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query('SELECT * FROM servicios WHERE id_servicio = ?', [id]);
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }
        res.json(result[0]);
    } catch (error) {
        console.error('[ERROR] getServicioById:', error.message);
        res.status(500).json({ error: 'Error al obtener el servicio' });
    }
};

// ============================================================
// CREAR SERVICIO
// - Si es ADMIN: crea directamente
// - Si es TECNICO: envía solicitud al admin
// ============================================================
export const crearServicio = async (req, res) => {
    try {
        const { nombre, descripcion, precio_base } = req.body;
        const userRol = req.user.rol;
        const usuarioNombre = req.user?.nombre || 'Tecnico';

        // Si es ADMIN, crea directamente
        if (userRol === 'ADMIN') {
            const [result] = await conmysql.query(
                'INSERT INTO servicios (nombre, descripcion, precio_base) VALUES (?, ?, ?)',
                [nombre, descripcion, precio_base]
            );

            res.status(201).json({ 
                mensaje: 'Servicio registrado con éxito', 
                id_servicio: result.insertId 
            });
            return;
        }

        // Si es TECNICO, envía solicitud al admin
        try {
            await notificarSolicitudServicio(conmysql, nombre, usuarioNombre);
            console.log('[FCM] Solicitud de servicio enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarSolicitudServicio:', notifError.message);
        }

        res.status(202).json({ 
            mensaje: 'Solicitud de servicio enviada al administrador para revisión',
            solicitud: true
        });

    } catch (error) {
        console.error('[ERROR] crearServicio:', error.message);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
};

// ============================================================
// ACTUALIZAR SERVICIO (SOLO ADMIN)
// ============================================================
export const actualizarServicio = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, precio_base } = req.body;
        
        // Solo ADMIN puede actualizar servicios
        if (req.user.rol !== 'ADMIN') {
            return res.status(403).json({ error: 'Solo administradores pueden actualizar servicios' });
        }

        const [result] = await conmysql.query(
            'UPDATE servicios SET nombre = ?, descripcion = ?, precio_base = ? WHERE id_servicio = ?',
            [nombre, descripcion, precio_base, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }

        res.json({ mensaje: 'Servicio actualizado con éxito' });
    } catch (error) {
        console.error('[ERROR] actualizarServicio:', error.message);
        res.status(500).json({ error: 'Error al actualizar el servicio' });
    }
};

// ============================================================
// ELIMINAR SERVICIO (SOLO ADMIN)
// ============================================================
export const eliminarServicio = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que el servicio no esté usado en órdenes
        const [usado] = await conmysql.query(
            'SELECT COUNT(*) as total FROM detalles_servicios WHERE id_servicio = ?',
            [id]
        );
        
        if (usado[0].total > 0) {
            return res.status(400).json({ 
                error: `No se puede eliminar. El servicio ha sido usado en ${usado[0].total} reparaciones.` 
            });
        }

        const [result] = await conmysql.query(
            'DELETE FROM servicios WHERE id_servicio = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }

        res.json({ mensaje: 'Servicio eliminado con éxito' });
    } catch (error) {
        console.error('[ERROR] eliminarServicio:', error.message);
        res.status(500).json({ error: 'Error al eliminar el servicio' });
    }
};