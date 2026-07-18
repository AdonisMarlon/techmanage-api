import { conmysql } from '../db.js';

// ==================== OBTENER TODAS LAS CATEGORÍAS ====================
export const getCategoriasEquipos = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            'SELECT * FROM categorias_equipos ORDER BY nombre ASC'
        );
        res.json(result);
    } catch (error) {
        console.error('Error al obtener categorías de equipos:', error);
        res.status(500).json({ error: 'Error al obtener las categorías' });
    }
};

// ==================== OBTENER CATEGORÍA POR ID ====================
export const getCategoriaEquipoById = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await conmysql.query(
            'SELECT * FROM categorias_equipos WHERE id_categoria_equipo = ?',
            [id]
        );
        if (result.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }
        res.json(result[0]);
    } catch (error) {
        console.error('Error al obtener categoría:', error);
        res.status(500).json({ error: 'Error al obtener la categoría' });
    }
};

// ==================== CREAR CATEGORÍA ====================
export const crearCategoriaEquipo = async (req, res) => {
    try {
        const { nombre, descripcion, icono } = req.body;
        
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }

        const [result] = await conmysql.query(
            'INSERT INTO categorias_equipos (nombre, descripcion, icono) VALUES (?, ?, ?)',
            [nombre.trim(), descripcion || '', icono || 'hardware-chip-outline']
        );

        res.status(201).json({
            mensaje: 'Categoría creada con éxito',
            id_categoria_equipo: result.insertId
        });
    } catch (error) {
        console.error('Error al crear categoría:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
        }
        res.status(500).json({ error: 'Error al crear la categoría' });
    }
};

// ==================== ACTUALIZAR CATEGORÍA ====================
export const actualizarCategoriaEquipo = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, icono } = req.body;

        const [result] = await conmysql.query(
            'UPDATE categorias_equipos SET nombre = ?, descripcion = ?, icono = ? WHERE id_categoria_equipo = ?',
            [nombre, descripcion || '', icono || 'hardware-chip-outline', id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        res.json({ mensaje: 'Categoría actualizada con éxito' });
    } catch (error) {
        console.error('Error al actualizar categoría:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
        }
        res.status(500).json({ error: 'Error al actualizar la categoría' });
    }
};

// ==================== ELIMINAR CATEGORÍA ====================
export const eliminarCategoriaEquipo = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar si tiene equipos asociados
        const [equipos] = await conmysql.query(
            'SELECT COUNT(*) as total FROM equipos WHERE id_categoria_equipo = ?',
            [id]
        );

        if (equipos[0].total > 0) {
            return res.status(400).json({
                error: `No se puede eliminar. Hay ${equipos[0].total} equipos usando esta categoría.`
            });
        }

        const [result] = await conmysql.query(
            'DELETE FROM categorias_equipos WHERE id_categoria_equipo = ?',
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