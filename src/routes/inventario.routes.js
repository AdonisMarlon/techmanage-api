import { Router } from 'express';
import { 
    getInventario, getRepuestoById, crearRepuesto, 
    getCategorias, crearCategoria, actualizarCategoria, 
    actualizarRepuesto, eliminarRepuesto,
    eliminarCategoria,subirImagenRepuesto
} from '../controladores/inventarioCtrl.js';
import { verificarToken, verificarAdmin } from '../middlewares/auth.js';

const router = Router();

// ===== INVENTARIO =====
router.get('/inventario', verificarToken, getInventario);
router.get('/inventario/:id', verificarToken, getRepuestoById);

// Solo ADMIN puede crear, editar o eliminar repuestos
router.post('/inventario', verificarToken, verificarAdmin, crearRepuesto);
router.put('/inventario/:id', verificarToken, verificarAdmin, actualizarRepuesto);
router.delete('/inventario/:id', verificarToken, verificarAdmin, eliminarRepuesto);

router.post('/inventario/:id/imagen', verificarToken, upload.single('imagen'), subirImagenRepuesto);

// ===== CATEGORIAS =====
router.get('/categorias', verificarToken, getCategorias);

// Solo ADMIN puede crear, editar o eliminar categorías
router.post('/categorias', verificarToken, verificarAdmin, crearCategoria);
router.put('/categorias/:id', verificarToken, verificarAdmin, actualizarCategoria);
router.delete('/categorias/:id', verificarToken, verificarAdmin, eliminarCategoria);


export default router;