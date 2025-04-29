const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors()); // Permitir solicitudes CORS desde GitHub Pages
app.use(express.json()); // Parsear JSON en las solicitudes

// Conexión a MongoDB local (sin autenticación, forzar IPv4)
const uri = "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000";
const client = new MongoClient(uri, { family: 4 }); // Forzar IPv4

let database; // Variable para almacenar la conexión a la base de datos

async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("Conectado a MongoDB");
        database = client.db('seventsport');
        const usuarios = database.collection('usuarios');
        const userCount = await usuarios.countDocuments();
        console.log(`Número de usuarios en la colección: ${userCount}`);
    } catch (error) {
        console.error("Error al conectar a MongoDB:", error);
        throw error; // Lanzar el error para detener el servidor
    }
}

// Iniciar el servidor solo después de conectar a MongoDB
async function startServer() {
    try {
        await connectToMongoDB();

        // Ruta de prueba para verificar que el servidor está funcionando
        app.get('/test', (req, res) => {
            res.json({ message: "El servidor está funcionando correctamente." });
        });

        // Endpoint para cambiar la contraseña
        app.post('/change-password', async (req, res) => {
            console.log("Solicitud recibida:", req.body); // Depuración
            const { email, currentPassword, newPassword } = req.body;

            // Validar que todos los campos estén presentes
            if (!email || !currentPassword || !newPassword) {
                return res.status(400).json({ success: false, message: "Faltan campos requeridos." });
            }

            try {
                const usuarios = database.collection('usuarios');

                // Verificar si el usuario existe y si la contraseña actual es correcta
                const user = await usuarios.findOne({ correo: email });
                console.log("Usuario encontrado:", user); // Depuración
                if (!user) {
                    return res.status(404).json({ success: false, message: "Usuario no encontrado." });
                }

                if (user.contraseña !== currentPassword) {
                    return res.status(401).json({ success: false, message: "La contraseña actual es incorrecta." });
                }

                // Actualizar la contraseña del usuario
                const result = await usuarios.updateOne(
                    { correo: email },
                    { $set: { contraseña: newPassword } }
                );
                console.log("Resultado de la actualización:", result); // Depuración

                if (result.modifiedCount === 0) {
                    return res.status(500).json({ success: false, message: "No se pudo actualizar la contraseña." });
                }

                res.json({ success: true, message: "Contraseña actualizada exitosamente." });
            } catch (error) {
                console.error("Error al cambiar la contraseña:", error);
                res.status(500).json({ success: false, message: error.message });
            }
        });

        // Iniciar el servidor
        const PORT = 3000;
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("No se pudo iniciar el servidor debido a un error en MongoDB:", error);
        process.exit(1); // Salir si no se puede conectar a MongoDB
    }
}

startServer();

// Manejar el cierre del servidor y la conexión a MongoDB
process.on('SIGINT', async () => {
    await client.close();
    console.log("Conexión a MongoDB cerrada.");
    process.exit(0);
});