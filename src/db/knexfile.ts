import { Knex } from 'knex'
import dotenv from 'dotenv'

dotenv.config()
// Update with your config settings.
const config: { [key: string]: Knex.Config } = {
    development: {
        client: 'mysql',
        connection: {
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        },
        migrations: {
            directory: './migrations',
        },
    },

    staging: {
        client: 'mysql',
        connection: {
            host: process.env.DB_HOST,
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            port: Number(process.env.DB_PORT),
            database: process.env.DB_NAME,
            ssl: {
                rejectUnauthorized: true,
            },
        },
        migrations: {
            directory: './migrations',
        },
    },

    production: {
        client: 'mysql',
        connection: {
            host: '127.0.0.1',
            port: 3306,
            user: 'your_database_user',
            password: 'your_database_password',
            database: 'myapp_test',
        },
        migrations: {
            directory: './migrations',
        },
    },
}
export default config