import { createPool } from "mysql2/promise";
import { DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE, DB_PORT } from './config.js';

export const conmysql = createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    port: DB_PORT,
    connectionLimit: 2,
    waitForConnections: true,
    queueLimit: 0
});