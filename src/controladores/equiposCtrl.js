import { conmysql } from '../db.js';
import { notificarNuevoEquipo, notificarEquipoEditado } from '../services/notification.service.js';

// ============================================================
// OBTENER TODOS LOS EQUIPOS
// ============================================================
export const getEquipos = async (req, res) => {
    try {
        const query = `
            SELECT e.*, 
                c.nombre_completo as cliente_nombre,
                cat.nombre as categoria_nombre 
            FROM equipos e
            INNER JOIN clientes c ON e.id_cliente = c.id_cliente
            LEFT JOIN categorias_equipos cat ON e.id_categoria_equipo = cat.id_categoria_equipo
            ORDER BY e.id_equipo DESC
        `;
        const [result] = await conmysql.query(query);
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getEquipos:', error.message);
        res.status(500).json({ error: 'Error al obtener los equipos' });
    }
};

// ============================================================
// OBTENER EQUIPO POR ID
// ============================================================
export const getEquipoById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT e.*, 
                cat.nombre as categoria_nombre
            FROM equipos e
            LEFT JOIN categorias_equipos cat ON e.id_categoria_equipo = cat.id_categoria_equipo
            WHERE e.id_equipo = ?
        `;
        const [result] = await conmysql.query(query, [id]);
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }
        res.json(result[0]);
    } catch (error) {
        console.error('[ERROR] getEquipoById:', error.message);
        res.status(500).json({ error: 'Error al obtener el equipo' });
    }
};

// ============================================================
// CREAR EQUIPO
// - Notifica al admin cuando cualquier usuario crea un equipo
// ============================================================
export const crearEquipo = async (req, res) => {
    try {
        const { id_cliente, id_categoria_equipo, tipo_equipo, marca, modelo, numero_serie, observaciones } = req.body;
        
        // Obtener nombre del cliente para la notificación
        const [clienteData] = await conmysql.query(
            'SELECT nombre_completo FROM clientes WHERE id_cliente = ?',
            [id_cliente]
        );
        const clienteNombre = clienteData[0]?.nombre_completo || 'Cliente';

        const [result] = await conmysql.query(
            'INSERT INTO equipos (id_cliente, id_categoria_equipo, tipo_equipo, marca, modelo, numero_serie, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id_cliente, id_categoria_equipo || null, tipo_equipo, marca, modelo, numero_serie, observaciones]
        );

        // NOTIFICACIÓN: Nuevo equipo creado
        try {
            const usuarioNombre = req.user?.nombre || 'Tecnico';
            await notificarNuevoEquipo(
                conmysql,
                { tipo_equipo, marca, modelo },
                clienteNombre,
                usuarioNombre
            );
            console.log('[FCM] Notificacion de nuevo equipo enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarNuevoEquipo:', notifError.message);
        }

        res.status(201).json({ 
            mensaje: 'Equipo registrado con exito', 
            id_equipo: result.insertId 
        });
    } catch (error) {
        console.error('[ERROR] crearEquipo:', error.message);
        res.status(500).json({ error: 'Error al registrar el equipo. Verifica que el id_cliente exista.' });
    }
};

// ============================================================
// ACTUALIZAR EQUIPO
// - Notifica al admin cuando cualquier usuario edita un equipo
// ============================================================
export const actualizarEquipo = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_cliente, id_categoria_equipo, tipo_equipo, marca, modelo, numero_serie, observaciones } = req.body;
        
        // Obtener nombre del cliente para la notificación
        const [clienteData] = await conmysql.query(
            'SELECT nombre_completo FROM clientes WHERE id_cliente = ?',
            [id_cliente]
        );
        const clienteNombre = clienteData[0]?.nombre_completo || 'Cliente';

        const [result] = await conmysql.query(
            'UPDATE equipos SET id_cliente = ?, id_categoria_equipo = ?, tipo_equipo = ?, marca = ?, modelo = ?, numero_serie = ?, observaciones = ? WHERE id_equipo = ?',
            [id_cliente, id_categoria_equipo || null, tipo_equipo, marca, modelo, numero_serie, observaciones, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }

        // NOTIFICACIÓN: Equipo editado
        try {
            const usuarioNombre = req.user?.nombre || 'Tecnico';
            await notificarEquipoEditado(
                conmysql,
                { tipo_equipo, marca, modelo },
                clienteNombre,
                usuarioNombre
            );
            console.log('[FCM] Notificacion de equipo editado enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarEquipoEditado:', notifError.message);
        }

        res.json({ mensaje: 'Equipo actualizado con exito' });
    } catch (error) {
        console.error('[ERROR] actualizarEquipo:', error.message);
        res.status(500).json({ error: 'Error al actualizar el equipo' });
    }
};

// ============================================================
// ELIMINAR EQUIPO (SOLO ADMIN)
// ============================================================
export const eliminarEquipo = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que el equipo no tenga órdenes activas
        const [ordenes] = await conmysql.query(
            'SELECT COUNT(*) as total FROM ordenes_trabajo WHERE id_equipo = ?',
            [id]
        );
        
        if (ordenes[0].total > 0) {
            return res.status(400).json({ 
                error: `No se puede eliminar. El equipo tiene ${ordenes[0].total} órdenes asociadas.` 
            });
        }

        const [result] = await conmysql.query(
            'DELETE FROM equipos WHERE id_equipo = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }

        res.json({ mensaje: 'Equipo eliminado con éxito' });
    } catch (error) {
        console.error('[ERROR] eliminarEquipo:', error.message);
        res.status(500).json({ error: 'Error al eliminar el equipo' });
    }
};