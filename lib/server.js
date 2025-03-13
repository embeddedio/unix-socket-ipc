const net = require('net');
const { getSocketPath, setSocketPermissions, cleanupSocket, log } = require('./utils');

class UnixSocketServer {
    constructor(name, options, messageHandler) {
        this.name = name;
        this.options = options;
        this.socketPath = getSocketPath(name);
        this.server = null;
        this.clients = new Map();
        this.messageHandler = messageHandler;
    }

    start(callback) {
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => {
                const clientId = Date.now() + Math.random().toString(36);
                this.clients.set(clientId, socket);

                socket.on('data', (data) => {
                    const messages = this.messageHandler.parseChunks(data.toString(), (event, data) => {
                        if (event === 'error') {
                            callback(event, data.message); // Simplifier les erreurs
                        } else {
                            callback(event, data);
                        }
                    });
                    messages.forEach(msg => callback('message', msg));
                });
                socket.on('end', () => this.clients.delete(clientId));
                socket.on('error', (err) => callback('error', err.message));
            });

            this.server.listen(this.socketPath, () => {
                setSocketPermissions(this.socketPath);
                log(this.options.verbose, `[${this.name}] Server started on ${this.socketPath}`);
                resolve();
            });

            this.server.on('error', (err) => {
                callback('error', err.message);
                reject(err.message);
            });
        });
    }

    send(message) {
        const chunks = this.messageHandler.chunkMessage(message);
        this.clients.forEach(client => {
            chunks.forEach(chunk => client.write(chunk + '\n'));
        });
    }

    cleanup() {
        if (this.server) {
            this.server.close();
        }
        cleanupSocket(this.socketPath);
    }
}

module.exports = UnixSocketServer;