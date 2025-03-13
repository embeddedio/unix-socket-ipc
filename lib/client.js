const net = require('net');
const { getSocketPath, log } = require('./utils');

class UnixSocketClient {
    constructor(name, options, messageHandler) {
        this.name = name;
        this.options = options || { verbose: false };
        this.socketPath = getSocketPath(name);
        this.socket = null;
        this.messageHandler = messageHandler;
    }

    connectInstance() {
        return new Promise((resolve) => {
            this.socket = net.connect(this.socketPath);
    
            this.socket.on('connect', () => {
                log(this.options.verbose, `[${this.name}] Connected as client to ${this.socketPath}`);
                resolve(this);
            });
    
            this.socket.on('error', (err) => {
                console.error(`Error: Server "${this.name}" does not exist`);
                resolve(null); // Ne pas rejeter, juste retourner null pour éviter le crash
            });
        });
    }
    

    send(message) {
        if (!this.socket) {
            console.log('error', 'Not connected');
            return;
        }
        const chunks = this.messageHandler.chunkMessage(message);
        chunks.forEach(chunk => this.socket.write(chunk + '\n'));
    }

    listen(callback) {
        if (!this.socket) {
            console.log('error', 'Not connected');
            return this;
        }

        this.socket.on('data', (data) => {
            const messages = this.messageHandler.parseChunks(data.toString(), (event, data) => {
                if (event === 'error') {
                    console.log(event, data.message);
                }
            });
            // Filtrer les messages internes pour les clients
            messages
                .filter(msg => msg.type !== 'internal_ping' && msg.type !== 'internal_pong')
                .forEach(msg => callback(msg));
        });

        this.socket.on('error', (err) => {
            console.log('error', err.message);
        });

        return this;
    }

    cleanup() {
        if (this.socket) {
            this.socket.destroy();
        }
    }

    checkAlive() {
        return new Promise((resolve) => {
            const socket = net.connect(this.socketPath);
            socket.setTimeout(1000);

            socket.on('connect', () => {
                const chunks = this.messageHandler.chunkMessage({ type: 'internal_ping' });
                chunks.forEach(chunk => socket.write(chunk + '\n'));

                socket.on('data', (data) => {
                    const messages = this.messageHandler.parseChunks(data.toString(), () => {});
                    if (messages.some(msg => msg.type === 'internal_pong')) {
                        socket.end();
                        resolve(true); // Instance vivante
                    }
                });

                socket.on('end', () => {
                    socket.destroy();
                    resolve(false); // Pas de réponse complète
                });
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve(false); // Instance inactive
            });

            socket.on('error', () => {
                socket.destroy();
                resolve(false); // Instance inactive
            });
        });
    }
}

module.exports = UnixSocketClient;