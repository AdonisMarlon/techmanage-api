import { Router } from 'express';
import { getClientes, getClienteById, crearCliente, actualizarCliente, eliminarCliente, buscarClientes } from '../controladores/clientesCtrl.js';
import { verificarToken, verificarAdmin } from '../middlewares/auth.js';

const router = Router();

router.get('/clientes/buscar', verificarToken, buscarClientes);
router.get('/clientes', verificarToken, getClientes);
router.get('/clientes/:id', verificarToken, getClienteById);
router.post('/clientes', verificarToken, crearCliente);
router.put('/clientes/:id', verificarToken, actualizarCliente);

// Solo ADMIN puede eliminar clientes
router.delete('/clientes/:id', verificarToken, verificarAdmin, eliminarCliente);

export default router;