import { conmysql } from '../db.js';
import bcrypt from 'bcryptjs';

// ===== OBTENER TECNICOS =====
export const getTecnicos = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            'SELECT id_usuario, nombre, correo, rol, estado FROM usuarios WHERE rol = "TECNICO" ORDER BY nombre ASC'
        );
        res.json(result);
    } catch (error) {
        console.error('Error al obtener tecnicos:', error);
        res.status(500).json({ error: 'Error al obtener los tecnicos' });
    }
};

// ===== CREAR USUARIO =====
export const crearUsuario = async (req, res) => {
    try {
        const { nombre, correo, password, rol } = req.body;
        
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        const [result] = await conmysql.query(
            'INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, correo, passwordEncriptada, rol || 'TECNICO']
        );

        res.status(201).json({ 
            mensaje: 'Usuario creado con éxito', 
            id_usuario: result.insertId 
        });
    } catch (error) {
        console.error('Error al crear usuario:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El correo ya está registrado' });
        }
        res.status(500).json({ error: 'Error al crear el usuario' });
    }
};

// ===== ACTUALIZAR USUARIO =====
export const actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, correo, estado } = req.body;

        const [result] = await conmysql.query(
            'UPDATE usuarios SET nombre = ?, correo = ?, estado = ? WHERE id_usuario = ?',
            [nombre, correo, estado, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ mensaje: 'Usuario actualizado con éxito' });
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error al actualizar el usuario' });
    }
};

// ===== ELIMINAR USUARIO =====
export const eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        
        // No permitir eliminar al admin principal
        const [usuario] = await conmysql.query(
            'SELECT rol FROM usuarios WHERE id_usuario = ?',
            [id]
        );
        
        if (usuario.length > 0 && usuario[0].rol === 'ADMIN') {
            return res.status(400).json({ error: 'No se puede eliminar un usuario administrador' });
        }

        const [result] = await conmysql.query(
            'DELETE FROM usuarios WHERE id_usuario = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ mensaje: 'Usuario eliminado con éxito' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
};

// ===== CAMBIAR CONTRASEÑA (Admin puede cambiar la de cualquier usuario) =====
export const cambiarPasswordAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevaPassword } = req.body;

        if (!nuevaPassword || nuevaPassword.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(nuevaPassword, salt);

        const [result] = await conmysql.query(
            'UPDATE usuarios SET password = ? WHERE id_usuario = ?',
            [passwordEncriptada, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ mensaje: 'Contraseña actualizada con éxito' });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
};

// ===== CAMBIAR PROPIA CONTRASEÑA (técnico cambia la suya) =====
export const cambiarPasswordPropio = async (req, res) => {
    try {
        const userId = req.user.id;
        const { passwordActual, nuevaPassword } = req.body;

        if (!passwordActual || !nuevaPassword) {
            return res.status(400).json({ error: 'Debe ingresar la contraseña actual y la nueva' });
        }

        if (nuevaPassword.length < 6) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
        }

        // Verificar contraseña actual
        const [usuario] = await conmysql.query(
            'SELECT password FROM usuarios WHERE id_usuario = ?',
            [userId]
        );

        if (usuario.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const passwordValida = await bcrypt.compare(passwordActual, usuario[0].password);
        if (!passwordValida) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(nuevaPassword, salt);

        await conmysql.query(
            'UPDATE usuarios SET password = ? WHERE id_usuario = ?',
            [passwordEncriptada, userId]
        );

        res.json({ mensaje: 'Contraseña actualizada con éxito' });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
};