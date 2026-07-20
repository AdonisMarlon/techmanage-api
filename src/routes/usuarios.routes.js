import { Router } from 'express';
import { 
    getTecnicos, 
    crearUsuario, 
    actualizarUsuario, 
    eliminarUsuario,
    cambiarPasswordAdmin,
    cambiarPasswordPropio,
    subirFotoPerfil
} from '../controladores/usuariosCtrl.js';
import { verificarToken, verificarAdmin } from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';


const router = Router();

// ===== VER TECNICOS =====
router.get('/usuarios/tecnicos', verificarToken, getTecnicos);

// ===== GESTION DE USUARIOS (solo Admin) =====
router.post('/usuarios', verificarToken, verificarAdmin, crearUsuario);
router.put('/usuarios/:id', verificarToken, verificarAdmin, actualizarUsuario);
router.delete('/usuarios/:id', verificarToken, verificarAdmin, eliminarUsuario);
router.put('/usuarios/:id/password', verificarToken, verificarAdmin, cambiarPasswordAdmin);

router.put('/usuarios/:id', verificarToken, actualizarUsuario);

router.put('/usuarios/cambiar-password', verificarToken, cambiarPasswordPropio);

router.post('/usuarios/:id/foto', verificarToken, upload.single('imagen'), subirFotoPerfil);

export default router;