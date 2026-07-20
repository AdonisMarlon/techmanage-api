import { conmysql } from '../db.js';
import bcrypt from 'bcryptjs';
import { notificarNuevoUsuario } from '../services/notification.service.js';
import { subirImagenAGitHub } from '../services/github.service.js';

// ===== SUBIR FOTO DE PERFIL =====
export const subirFotoPerfil = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        if (parseInt(id) !== userId) {
            return res.status(403).json({ error: 'No puedes subir foto a otro usuario' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ninguna imagen' });
        }

        console.log('Foto de perfil recibida:', req.file.filename);

        const imagenUrl = await subirImagenAGitHub(req.file.path, req.file.filename, 'uploads/usuarios');

        const [result] = await conmysql.query(
            'UPDATE usuarios SET foto_perfil = ? WHERE id_usuario = ?',
            [imagenUrl, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ 
            mensaje: 'Foto de perfil subida con exito',
            imagenUrl: imagenUrl
        });

    } catch (error) {
        console.error('[ERROR] subirFotoPerfil:', error.message);
        res.status(500).json({ error: 'Error al subir la foto' });
    }
};

// ===== OBTENER TECNICOS =====
export const getTecnicos = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            'SELECT id_usuario, nombre, correo, rol, estado, foto_perfil FROM usuarios WHERE rol = "TECNICO" ORDER BY nombre ASC'
        );
        res.json(result);
    } catch (error) {
        console.error('[ERROR] getTecnicos:', error.message);
        res.status(500).json({ error: 'Error al obtener los tecnicos' });
    }
};

// ===== OBTENER USUARIO POR ID (CUALQUIER ROL) =====
export const getUsuarioById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [result] = await conmysql.query(
            'SELECT id_usuario, nombre, correo, rol, estado, foto_perfil FROM usuarios WHERE id_usuario = ?',
            [id]
        );
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json(result[0]);
    } catch (error) {
        console.error('[ERROR] getUsuarioById:', error.message);
        res.status(500).json({ error: 'Error al obtener el usuario' });
    }
};

// ===== CREAR USUARIO (SOLO ADMIN) =====
export const crearUsuario = async (req, res) => {
    try {
        const { nombre, correo, password, rol } = req.body;
        const adminNombre = req.user?.nombre || 'Admin';
        
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        const [result] = await conmysql.query(
            'INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, correo, passwordEncriptada, rol || 'TECNICO']
        );

        try {
            await notificarNuevoUsuario(
                conmysql,
                { nombre, rol: rol || 'TECNICO' },
                adminNombre
            );
            console.log('[FCM] Notificacion de nuevo usuario enviada al admin');
        } catch (notifError) {
            console.error('[ERROR] notificarNuevoUsuario:', notifError.message);
        }

        res.status(201).json({ 
            mensaje: 'Usuario creado con exito', 
            id_usuario: result.insertId 
        });
    } catch (error) {
        console.error('[ERROR] crearUsuario:', error.message);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El correo ya esta registrado' });
        }
        res.status(500).json({ error: 'Error al crear el usuario' });
    }
};

// ===== ACTUALIZAR USUARIO (CUALQUIER USUARIO PUEDE ACTUALIZAR SU PERFIL) =====
export const actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, correo, estado, rol, foto_perfil } = req.body;
        const userId = req.user.id;
        const userRol = req.user.rol;

        // Cualquier usuario solo puede editar su propio perfil
        if (parseInt(id) !== userId) {
            return res.status(403).json({ error: 'No puedes editar a otro usuario' });
        }

        // TECNICO: solo puede cambiar nombre, correo y foto_perfil
        if (userRol === 'TECNICO') {
            const [result] = await conmysql.query(
                'UPDATE usuarios SET nombre = ?, correo = ?, foto_perfil = ? WHERE id_usuario = ?',
                [nombre, correo, foto_perfil || null, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // Obtener usuario actualizado
            const [usuarioActualizado] = await conmysql.query(
                'SELECT id_usuario, nombre, correo, rol, estado, foto_perfil FROM usuarios WHERE id_usuario = ?',
                [id]
            );

            return res.json({
                mensaje: 'Perfil actualizado con exito',
                usuario: usuarioActualizado[0]
            });
        }

        // ADMIN: puede editar todo
        let query = 'UPDATE usuarios SET nombre = ?, correo = ?';
        let params = [nombre, correo];

        if (estado !== undefined) {
            query += ', estado = ?';
            params.push(estado);
        }
        if (rol !== undefined) {
            query += ', rol = ?';
            params.push(rol);
        }
        if (foto_perfil !== undefined) {
            query += ', foto_perfil = ?';
            params.push(foto_perfil);
        }

        query += ' WHERE id_usuario = ?';
        params.push(id);

        const [result] = await conmysql.query(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ mensaje: 'Usuario actualizado con exito' });
    } catch (error) {
        console.error('[ERROR] actualizarUsuario:', error.message);
        res.status(500).json({ error: 'Error al actualizar el usuario' });
    }
};

// ===== ELIMINAR USUARIO (SOLO ADMIN) =====
export const eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [usuario] = await conmysql.query(
            'SELECT rol, nombre FROM usuarios WHERE id_usuario = ?',
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

        console.log(`[FCM] Usuario ${usuario[0]?.nombre || 'N/A'} eliminado`);

        res.json({ mensaje: 'Usuario eliminado con exito' });
    } catch (error) {
        console.error('[ERROR] eliminarUsuario:', error.message);
        res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
};

// ===== CAMBIAR CONTRASEÑA (Admin) =====
export const cambiarPasswordAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevaPassword } = req.body;

        if (!nuevaPassword || nuevaPassword.length < 6) {
            return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
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

        res.json({ mensaje: 'Contrasena actualizada con exito' });
    } catch (error) {
        console.error('[ERROR] cambiarPasswordAdmin:', error.message);
        res.status(500).json({ error: 'Error al cambiar la contrasena' });
    }
};

// ===== CAMBIAR PROPIA CONTRASEÑA (CUALQUIER USUARIO) =====
export const cambiarPasswordPropio = async (req, res) => {
    try {
        const userId = req.user.id;
        const { passwordActual, nuevaPassword } = req.body;

        if (!passwordActual || !nuevaPassword) {
            return res.status(400).json({ error: 'Debe ingresar la contrasena actual y la nueva' });
        }

        if (nuevaPassword.length < 6) {
            return res.status(400).json({ error: 'La nueva contrasena debe tener al menos 6 caracteres' });
        }

        const [usuario] = await conmysql.query(
            'SELECT password FROM usuarios WHERE id_usuario = ?',
            [userId]
        );

        if (usuario.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const passwordValida = await bcrypt.compare(passwordActual, usuario[0].password);
        if (!passwordValida) {
            return res.status(401).json({ error: 'Contrasena actual incorrecta' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(nuevaPassword, salt);

        await conmysql.query(
            'UPDATE usuarios SET password = ? WHERE id_usuario = ?',
            [passwordEncriptada, userId]
        );

        res.json({ mensaje: 'Contrasena actualizada con exito' });
    } catch (error) {
        console.error('[ERROR] cambiarPasswordPropio:', error.message);
        res.status(500).json({ error: 'Error al cambiar la contrasena' });
    }
};