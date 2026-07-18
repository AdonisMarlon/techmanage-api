import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import clientesRoutes from './routes/clientes.routes.js';
import inventarioRoutes from './routes/inventario.routes.js';
import equiposRoutes from './routes/equipos.routes.js';
import serviciosRoutes from './routes/servicios.routes.js';
import ordenesRoutes from './routes/ordenes.routes.js';
import facturasRoutes from './routes/facturas.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import categoriasEquiposRoutes from './routes/categoriasEquipos.routes.js';

const app = express();

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api', clientesRoutes);
app.use('/api', inventarioRoutes);
app.use('/api', equiposRoutes);
app.use('/api', serviciosRoutes);
app.use('/api', ordenesRoutes);
app.use('/api', facturasRoutes);
app.use('/api', usuariosRoutes);
app.use('/api', categoriasEquiposRoutes);

app.use((req, res, next) => {
    res.status(404).json({
        message: 'Endpoint no encontrado en TechManage'
    });
});

export default app;