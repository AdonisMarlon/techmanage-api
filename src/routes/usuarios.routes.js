import { Router } from 'express';
import { 
    getTecnicos, 
    crearUsuario, 
    actualizarUsuario, 
    eliminarUsuario,
    cambiarPasswordAdmin,
    cambiarPasswordPropio
} from '../controladores/usuariosCtrl.js';
import { verificarToken, verificarAdmin } from '../middlewares/auth.js';

const router = Router();

// ===== VER TECNICOS =====
router.get('/usuarios/tecnicos', verificarToken, getTecnicos);

// ===== GESTION DE USUARIOS (solo Admin) =====
router.post('/usuarios', verificarToken, verificarAdmin, crearUsuario);
router.put('/usuarios/:id', verificarToken, verificarAdmin, actualizarUsuario);
router.delete('/usuarios/:id', verificarToken, verificarAdmin, eliminarUsuario);

// ===== CAMBIAR CONTRASEÑA =====
// Admin cambia la contraseña de cualquier usuario
router.put('/usuarios/:id/password', verificarToken, verificarAdmin, cambiarPasswordAdmin);

// Técnico cambia su propia contraseña
router.put('/usuarios/cambiar-password', verificarToken, cambiarPasswordPropio);

export default router;