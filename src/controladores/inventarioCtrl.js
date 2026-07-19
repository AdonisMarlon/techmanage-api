import { conmysql } from '../db.js';
import { notificarStockBajo } from '../services/notification.service.js';

// 1. Obtener todo el inventario (con el nombre de su categoría)
export const getInventario = async (req, res) => {
    try {
        // Usamos un JOIN para traer el nombre de la categoría y no solo el ID
        const query = `
            SELECT i.*, c.nombre as categoria_nombre 
            FROM inventario i
            LEFT JOIN categorias_inventario c ON i.id_categoria = c.id_categoria
            ORDER BY i.nombre ASC
        `;
        const [result] = await conmysql.query(query);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el inventario' });
    }
};

// 2. Obtener un repuesto por ID
export const getRepuestoById = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query('SELECT * FROM inventario WHERE id_repuesto = ?', [id]);
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Repuesto no encontrado' });
        }
        res.json(result[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el repuesto' });
    }
};

// 3. Agregar un nuevo repuesto al inventario
export const crearRepuesto = async (req, res) => {
    try {
        const { id_categoria, nombre, descripcion, cantidad_stock, precio_unitario } = req.body;
        
        const [result] = await conmysql.query(
            'INSERT INTO inventario (id_categoria, nombre, descripcion, cantidad_stock, precio_unitario) VALUES (?, ?, ?, ?, ?)',
            [id_categoria, nombre, descripcion, cantidad_stock, precio_unitario]
        );

        // NOTIFICACIÓN DE STOCK BAJO
        if (cantidad_stock <= 3) {
            try {
                await notificarStockBajo(
                    conmysql,
                    { id_repuesto: result.insertId, nombre: nombre },
                    cantidad_stock,
                    req.user?.nombre || 'Tecnico',
                    req.user?.id
                );
            } catch (notifError) {
                console.error('[ERROR] Notificacion stock bajo:', notifError.message);
            }
        }

        res.status(201).json({ 
            mensaje: 'Repuesto registrado con éxito', 
            id_repuesto: result.insertId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar el repuesto' });
    }
};

//4. Obtener todas las categorías del inventario
export const getCategorias = async (req, res) => {
    try {
        // Hacemos la consulta a tu tabla categorias_inventario
        const [rows] = await conmysql.query('SELECT * FROM categorias_inventario');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al consultar las categorías' });
    }
};

//5. Insertar una nueva categoría de inventario
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
        console.error(error);
        res.status(500).json({ error: 'Error al crear la categoría' });
    }
};

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
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar la categoría' });
    }
};

// Actualizar un repuesto
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

        //NOTIFICACIÓN DE STOCK BAJO (solo si bajó a ≤ 3 y antes estaba > 3)
        if (cantidad_stock <= 3 && stockAnterior > 3) {
            try {
                await notificarStockBajo(
                    conmysql,
                    { id_repuesto: id, nombre: nombre },
                    cantidad_stock,
                    req.user?.nombre || 'Tecnico',
                    req.user?.id
                );
            } catch (notifError) {
                console.error('[ERROR] Notificacion stock bajo:', notifError.message);
            }
        }

        res.json({ mensaje: 'Repuesto actualizado con éxito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el repuesto' });
    }
};

// ===== ELIMINAR REPUESTO =====
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
        console.error('Error al eliminar repuesto:', error);
        res.status(500).json({ error: 'Error al eliminar el repuesto' });
    }
};


// ===== ELIMINAR CATEGORÍA =====
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
        console.error('Error al eliminar categoría:', error);
        res.status(500).json({ error: 'Error al eliminar la categoría' });
    }
};