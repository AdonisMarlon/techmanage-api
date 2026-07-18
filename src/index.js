import app from './app.js';
import { PORT } from './config.js';

app.listen(PORT);
console.log(`=========================================`);
console.log(`🚀 Servidor de TechManage ejecutándose en el puerto ${PORT}`);
console.log(`=========================================`);