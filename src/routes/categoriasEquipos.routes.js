import { Router } from 'express';
import {
    getCategoriasEquipos,
    getCategoriaEquipoById,
    crearCategoriaEquipo,
    actualizarCategoriaEquipo,
    eliminarCategoriaEquipo
} from '../controladores/categoriasEquiposCtrl.js';
import { verificarToken, verificarAdmin } from '../middlewares/auth.js';

const router = Router();

// Todos los autenticados pueden ver categorías
router.get('/categorias-equipos', verificarToken, getCategoriasEquipos);
router.get('/categorias-equipos/:id', verificarToken, getCategoriaEquipoById);

// Solo ADMIN puede gestionar categorías
router.post('/categorias-equipos', verificarToken, verificarAdmin, crearCategoriaEquipo);
router.put('/categorias-equipos/:id', verificarToken, verificarAdmin, actualizarCategoriaEquipo);
router.delete('/categorias-equipos/:id', verificarToken, verificarAdmin, eliminarCategoriaEquipo);

export default router;