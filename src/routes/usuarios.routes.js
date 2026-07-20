import { Router } from 'express';
import { 
    getTecnicos, 
    crearUsuario, 
    actualizarUsuario, 
    eliminarUsuario,
    cambiarPasswordAdmin,
    cambiarPasswordPropio,
    subirFotoPerfil,
    getUsuarioById
} from '../controladores/usuariosCtrl.js';
import { verificarToken, verificarAdmin } from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';

const router = Router();

// ===== VER TECNICOS =====
router.get('/usuarios/tecnicos', verificarToken, getTecnicos);

// ===== OBTENER USUARIO POR ID (CUALQUIER USUARIO AUTENTICADO) =====
router.get('/usuarios/:id', verificarToken, getUsuarioById);

// ===== GESTION DE USUARIOS (solo Admin) =====
router.post('/usuarios', verificarToken, verificarAdmin, crearUsuario);
router.delete('/usuarios/:id', verificarToken, verificarAdmin, eliminarUsuario);
router.put('/usuarios/:id/password', verificarToken, verificarAdmin, cambiarPasswordAdmin);

// ===== CUALQUIER USUARIO PUEDE ACTUALIZAR SU PROPIO PERFIL =====
router.put('/usuarios/:id', verificarToken, actualizarUsuario);

// ===== CUALQUIER USUARIO PUEDE CAMBIAR SU PROPIA CONTRASEÑA =====
router.put('/usuarios/cambiar-password', verificarToken, cambiarPasswordPropio);

// ===== CUALQUIER USUARIO PUEDE SUBIR SU FOTO DE PERFIL =====
router.post('/usuarios/:id/foto', verificarToken, upload.single('imagen'), subirFotoPerfil);

export default router;