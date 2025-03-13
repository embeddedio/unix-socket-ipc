const EventEmitter = require('events');
const UnixSocketServer = require('./lib/server');
const UnixSocketClient = require('./lib/client');
const MessageHandler = require('./lib/messageHandler');
const { getSocketPath, cleanupSocket, log } = require('./lib/utils');
const fs = require('fs');

class UnixSocketIPC extends EventEmitter {
    constructor(name, options = {}) {
        super();
        this.name = name;
        this.options = { verbose: false, force: false, ...options };
        this.socketPath = getSocketPath(name);
        this.isMaster = false;
        this.instance = null;
        this.messageHandler = new MessageHandler();

        // Ajouter un gestionnaire par défaut pour éviter ERR_UNHANDLED_ERROR
        this.on('error', (message) => {
            if (this.options.verbose) {
                console.error(`[${this.name}] Error: ${message}`);
            }
        });
    }

    async init() {
        try {
            if (fs.existsSync(this.socketPath)) {
                const client = new UnixSocketClient(this.name, this.options, this.messageHandler);
                const isAlive = await client.checkAlive();

                if (isAlive) {
                    if (this.options.force) {
                        log(this.options.verbose, `[${this.name}] Forcing override of existing socket`);
                        cleanupSocket(this.socketPath);
                        await this.startAsMaster();
                    } else {
                        this.emit('error', `Server name "${this.name}" instance is occupied`);
                        return this; // Retourner l'instance sans crash
                    }
                } else {
                    log(this.options.verbose, `[${this.name}] Cleaning up inactive socket`);
                    cleanupSocket(this.socketPath);
                    await this.startAsMaster();
                }
            } else {
                await this.startAsMaster();
            }

            this.registerCleanupHandlers();
            return this;
        } catch (error) {
            this.emit('error', error.message || 'An error occurred during initialization');
            return this; // Retourner l'instance sans crash
        }
    }

    async startAsMaster() {
        this.isMaster = true;
        this.instance = new UnixSocketServer(this.name, this.options, this.messageHandler);
        await this.instance.start((event, data) => {
            if (event === 'error') {
                this.emit(event, data.message || data);
            } else if (event === 'message' && data.type === 'internal_ping') {
                this.instance.send({ type: 'internal_pong' });
            } else if (data.type !== 'internal_pong') {
                this.emit(event, data);
            }
        });
        log(this.options.verbose, `[${this.name}] Initialized as master`);
    }

    send(message) {
        if (!this.instance) {
            this.emit('error', 'Instance not initialized');
            return;
        }
        try {
            this.instance.send(message);
        } catch (error) {
            this.emit('error', error.message);
        }
    }

    listen(callback) {
        this.on('message', callback);
        return this;
    }

    registerCleanupHandlers() {
        process.on('exit', () => this.instance?.cleanup());
        process.on('SIGINT', () => {
            this.instance?.cleanup();
            process.exit();
        });
    }

    discover() {
        return [{ name: this.name, path: this.socketPath }];
    }
}

module.exports = {
    init: (name, options) => new UnixSocketIPC(name, options).init(),
    connect: (name, options) => new UnixSocketClient(name, options, new MessageHandler()).connectInstance()
};