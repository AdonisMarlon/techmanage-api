import { conmysql } from '../db.js';
import { 
    notificarNuevoRepuesto, 
    notificarRepuestoEditado, 
    notificarStockBajo 
} from '../services/notification.service.js';
import { subirImagenAGitHub } from '../services/github.service.js';


// ===== SUBIR IMAGEN DE REPUESTO =====
export const subirImagenRepuesto = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ninguna imagen' });
        }

        console.log('Imagen de repuesto recibida:', req.file.filename);

        // Subir a GitHub
        const imagenUrl = await subirImagenAGitHub(req.file.path, req.file.filename, 'uploads/inventario');

        // Guardar URL en la base de datos
        const [result] = await conmysql.query(
            'UPDATE inventario SET imagen = ? WHERE id_repuesto = ?',
            [imagenUrl, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Repuesto no encontrado' });
        }

        res.json({ 
            mensaje: 'Imagen subida con éxito',
            imagenUrl: imagenUrl
        });

    } catch (error) {
        console.error('[ERROR] subirImagenRepuesto:', error.message);
        res.status(500).json({ error: 'Error al subir la imagen' });
    }
};

// ============================================================
// OBTENER TODO EL INVENTARIO
// ============================================================
export const getInventario = async (req, res) => {
    try {
        const query = `
            SELECT i.*, c.nombre as categoria_nombre 
            FROM inventario i
            LEFT JOIN categorias_inventario c ON i.id_categoria = c.id_categoria
            ORDER BY i.nombre ASC
        `;
        const [result] = await conmysql.query(query);
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getInventario:', error.message);
        res.status(500).json({ error: 'Error al obtener el inventario' });
    }
};

// ============================================================
// OBTENER REPUESTO POR ID
// ============================================================
export const getRepuestoById = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query('SELECT * FROM inventario WHERE id_repuesto = ?', [id]);
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Repuesto no encontrado' });
        }
        res.json(result[0]);
    } catch (error) {
        console.error('[ERROR] getRepuestoById:', error.message);
        res.status(500).json({ error: 'Error al obtener el repuesto' });
    }
};

// ============================================================
// CREAR REPUESTO
// - Notifica al admin cuando se crea un repuesto
// - Notifica stock bajo si aplica
// ============================================================
export const crearRepuesto = async (req, res) => {
    try {
        const { id_categoria, nombre, descripcion, cantidad_stock, precio_unitario } = req.body;
        
        const [result] = await conmysql.query(
            'INSERT INTO inventario (id_categoria, nombre, descripcion, cantidad_stock, precio_unitario) VALUES (?, ?, ?, ?, ?)',
            [id_categoria, nombre, descripcion, cantidad_stock, precio_unitario]
        );

        // NOTIFICACIÓN: Nuevo repuesto creado
        try {
            const usuarioNombre = req.user?.nombre || 'Tecnico';
            await notificarNuevoRepuesto(
                conmysql,
                { nombre, cantidad_stock, precio_unitario },
                usuarioNombre
            );
            console.log('[FCM] Notificacion de nuevo repuesto enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarNuevoRepuesto:', notifError.message);
        }

        //NOTIFICACIÓN: Stock bajo (si aplica)
        if (cantidad_stock <= 3) {
            try {
                await notificarStockBajo(
                    conmysql,
                    { id_repuesto: result.insertId, nombre: nombre },
                    cantidad_stock,
                    req.user?.nombre || 'Tecnico'
                );
                console.log('[FCM] Notificacion de stock bajo enviada al admin');
            } catch (notifError) {
                console.error('[ERROR] notificarStockBajo:', notifError.message);
            }
        }

        res.status(201).json({ 
            mensaje: 'Repuesto registrado con éxito', 
            id_repuesto: result.insertId 
        });
    } catch (error) {
        console.error('[ERROR] crearRepuesto:', error.message);
        res.status(500).json({ error: 'Error al registrar el repuesto' });
    }
};

// ============================================================
// OBTENER TODAS LAS CATEGORÍAS DEL INVENTARIO
// ============================================================
export const getCategorias = async (req, res) => {
    try {
        const [rows] = await conmysql.query('SELECT * FROM categorias_inventario');
        res.json(rows);
    } catch (error) {
        console.error('[ERROR] getCategorias:', error.message);
        res.status(500).json({ error: 'Error al consultar las categorías' });
    }
};

// ============================================================
// CREAR CATEGORÍA (SOLO ADMIN)
// ============================================================
export const crearCategoria = async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' });
        }
        const [result] = await conmysql.query(
            'INSERT INTO categorias_inventario (nombre, descripcion) VALUES (?, ?)',
            [nombre, descripcion]
        );
        res.status(201).json({ 
            mensaje: 'Categoría creada con éxito', 
            id_categoria: result.insertId 
        });
    } catch (error) {
        console.error('[ERROR] crearCategoria:', error.message);
        res.status(500).json({ error: 'Error al crear la categoría' });
    }
};

// ============================================================
// ACTUALIZAR CATEGORÍA (SOLO ADMIN)
// ============================================================
export const actualizarCategoria = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;
        const [result] = await conmysql.query(
            'UPDATE categorias_inventario SET nombre = ?, descripcion = ? WHERE id_categoria = ?',
            [nombre, descripcion, id]
        );
        res.json({ mensaje: 'Categoría actualizada con éxito' });
    } catch (error) {
        console.error('[ERROR] actualizarCategoria:', error.message);
        res.status(500).json({ error: 'Error al actualizar la categoría' });
    }
};

// ============================================================
// ACTUALIZAR REPUESTO
// - Notifica al admin cuando se edita un repuesto
// - Notifica stock bajo si aplica
// ============================================================
export const actualizarRepuesto = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_categoria, nombre, descripcion, cantidad_stock, precio_unitario } = req.body;
        
        // Obtener el stock anterior para comparar
        const [repuestoAnterior] = await conmysql.query(
            'SELECT cantidad_stock FROM inventario WHERE id_repuesto = ?',
            [id]
        );

        if (repuestoAnterior.length === 0) {
            return res.status(404).json({ error: 'Repuesto no encontrado' });
        }

        const stockAnterior = repuestoAnterior[0].cantidad_stock;

        const [result] = await conmysql.query(
            'UPDATE inventario SET id_categoria = ?, nombre = ?, descripcion = ?, cantidad_stock = ?, precio_unitario = ? WHERE id_repuesto = ?',
            [id_categoria, nombre, descripcion, cantidad_stock, precio_unitario, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Repuesto no encontrado' });
        }

        // NOTIFICACIÓN: Repuesto editado
        try {
            const usuarioNombre = req.user?.nombre || 'Tecnico';
            await notificarRepuestoEditado(
                conmysql,
                { nombre, cantidad_stock, precio_unitario },
                usuarioNombre
            );
            console.log('[FCM] Notificacion de repuesto editado enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarRepuestoEditado:', notifError.message);
        }

        // NOTIFICACIÓN: Stock bajo (solo si bajó a ≤ 3 y antes estaba > 3)
        if (cantidad_stock <= 3 && stockAnterior > 3) {
            try {
                await notificarStockBajo(
                    conmysql,
                    { id_repuesto: id, nombre: nombre },
                    cantidad_stock,
                    req.user?.nombre || 'Tecnico'
                );
                console.log('[FCM] Notificacion de stock bajo enviada al admin');
            } catch (notifError) {
                console.error('[ERROR] notificarStockBajo:', notifError.message);
            }
        }

        res.json({ mensaje: 'Repuesto actualizado con éxito' });
    } catch (error) {
        console.error('[ERROR] actualizarRepuesto:', error.message);
        res.status(500).json({ error: 'Error al actualizar el repuesto' });
    }
};

// ============================================================
// ELIMINAR REPUESTO (SOLO ADMIN)
// ============================================================
export const eliminarRepuesto = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que el repuesto no esté usado en órdenes
        const [usado] = await conmysql.query(
            'SELECT COUNT(*) as total FROM detalles_reparacion WHERE id_repuesto = ?',
            [id]
        );
        
        if (usado[0].total > 0) {
            return res.status(400).json({ 
                error: `No se puede eliminar. El repuesto ha sido usado en ${usado[0].total} reparaciones.` 
            });
        }

        const [result] = await conmysql.query(
            'DELETE FROM inventario WHERE id_repuesto = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Repuesto no encontrado' });
        }

        res.json({ mensaje: 'Repuesto eliminado con éxito' });
    } catch (error) {
        console.error('[ERROR] eliminarRepuesto:', error.message);
        res.status(500).json({ error: 'Error al eliminar el repuesto' });
    }
};

// ============================================================
// ELIMINAR CATEGORÍA (SOLO ADMIN)
// ============================================================
export const eliminarCategoria = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que la categoría no tenga productos asociados
        const [productos] = await conmysql.query(
            'SELECT COUNT(*) as total FROM inventario WHERE id_categoria = ?',
            [id]
        );
        
        if (productos[0].total > 0) {
            return res.status(400).json({ 
                error: `No se puede eliminar. La categoría tiene ${productos[0].total} productos asociados.` 
            });
        }

        const [result] = await conmysql.query(
            'DELETE FROM categorias_inventario WHERE id_categoria = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        res.json({ mensaje: 'Categoría eliminada con éxito' });
    } catch (error) {
        console.error('[ERROR] eliminarCategoria:', error.message);
        res.status(500).json({ error: 'Error al eliminar la categoría' });
    }
};