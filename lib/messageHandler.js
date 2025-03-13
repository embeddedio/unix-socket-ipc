const { DEFAULT_MAX_CHUNK_SIZE, DEFAULT_TIMEOUT } = require('./constants');
const Ajv = require('ajv');
const ajv = new Ajv();

class MessageHandler {
    constructor(maxChunkSize = DEFAULT_MAX_CHUNK_SIZE) {
        this.maxChunkSize = maxChunkSize;
        this.buffers = new Map();
    }

    // Vérification interne de la validité JSON
    #isValidJson(str) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

    // Découpage transparent des messages
    chunkMessage(message) {
        const messageId = Date.now() + Math.random().toString(36);
        const jsonMessage = JSON.stringify(message);
        
        if (!this.#isValidJson(jsonMessage)) {
            throw new Error('Invalid JSON input');
        }

        const buffer = Buffer.from(jsonMessage);
        const chunks = [];

        for (let i = 0; i < buffer.length; i += this.maxChunkSize) {
            const chunk = buffer.slice(i, i + this.maxChunkSize);
            const header = JSON.stringify({
                id: messageId,
                index: chunks.length,
                total: Math.ceil(buffer.length / this.maxChunkSize),
                size: chunk.length
            });
            chunks.push(Buffer.from(`${header}||${chunk.toString()}`));
        }
        return chunks;
    }

    // Assemblage transparent des chunks
    parseChunks(data, callback) {
        const messages = new Map();
        const lines = data.toString().split('\n').filter(line => line.trim());

        for (const line of lines) {
            try {
                // Gestion des messages mal formés (compatibilité anciens pings)
                if (!line.includes('||')) {
                    if (this.#isValidJson(line)) {
                        const parsed = JSON.parse(line);
                        messages.set(Date.now().toString(), parsed);
                    }
                    continue;
                }

                const [headerStr, content] = line.split('||');
                if (!headerStr || !content) {
                    callback('error', new Error('Malformed chunk received'));
                    continue;
                }

                const meta = JSON.parse(headerStr);
                const bufferKey = meta.id;

                if (!this.buffers.has(bufferKey)) {
                    this.buffers.set(bufferKey, {
                        chunks: new Array(meta.total),
                        received: 0,
                        timeout: setTimeout(() => {
                            this.buffers.delete(bufferKey);
                            callback('error', new Error(`Timeout assembling message ${bufferKey}`));
                        }, DEFAULT_TIMEOUT)
                    });
                }

                const buffer = this.buffers.get(bufferKey);
                buffer.chunks[meta.index] = content;
                buffer.received++;

                if (buffer.received === meta.total) {
                    clearTimeout(buffer.timeout);
                    const fullMessage = buffer.chunks.join('');
                    if (this.#isValidJson(fullMessage)) {
                        const parsedMessage = JSON.parse(fullMessage);
                        if (ajv.validate({ type: 'object' }, parsedMessage)) {
                            messages.set(bufferKey, parsedMessage);
                        } else {
                            callback('invalid_message', new Error('Received invalid JSON object'));
                        }
                    } else {
                        callback('invalid_message', new Error('Assembled message is not valid JSON'));
                    }
                    this.buffers.delete(bufferKey);
                }
            } catch (error) {
                callback('error', error);
            }
        }

        return Array.from(messages.values());
    }
}

module.exports = MessageHandler;