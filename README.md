# unix-socket-ipc - Unix Socket IPC Module

## Introduction

`unix-socket-ipc` is a lightweight Node.js module designed to simplify inter-process communication (IPC) between applications using Unix sockets. It provides a straightforward API to create server instances and connect clients, leveraging JSON as the message exchange format. The module handles socket creation, conflict resolution, message chunking, and cleanup transparently, making it an efficient solution for local communication in Node.js applications.

## What Are Unix Sockets?

Unix sockets (or Unix domain sockets) are a high-performance IPC mechanism available on Unix-like operating systems. They enable processes on the same machine to exchange data via a special file in the filesystem (e.g., `/tmp/my-service.sock`). Unlike TCP sockets, which operate over a network, Unix sockets:

- Offer **low latency** by bypassing network stacks.
- Provide **security** through filesystem permissions.
- Are identified by a simple file path rather than IP addresses and ports.

`unix-socket-ipc` abstracts the complexity of Unix socket management, allowing developers to focus on application logic rather than low-level socket handling.

## Platform Compatibility

This module is compatible with **Linux** and **macOS**, where Unix sockets are natively supported. It does **not** support **Windows**, as Unix sockets are not available on that platform. Future versions may include a TCP fallback for broader compatibility.

## Prerequisites

- **Node.js**: Version 12 or higher.
- **Operating System**: Linux or macOS (Windows is not supported due to the lack of Unix sockets).
- **Dependencies**: Requires the `ajv` package for JSON validation (installed automatically via npm).

## Installation

Install the module from npm:

```bash
npm install unix-socket-ipc
```

This will also install the required dependency `ajv` as specified in the module's `package.json`.

## Usage

`unix-socket-ipc` provides two primary functions:

- `init(name, options)`: Initializes a server instance with the specified name.
- `connect(name, options)`: Connects a client to an existing server instance.

### Creating a Server Instance

The server creates a Unix socket (e.g., `/tmp/my-service.sock`) and listens for incoming messages.

```javascript
const ipc = require('unix-socket-ipc');

(async () => {
    const server = await ipc.init('my-service', {
        verbose: true, // Enable logging
        force: false   // Default: does not override existing instance
    });
    server.listen((msg) => {
        console.log('Server received:', msg);
    });
    server.on('error', (err) => {
        console.error('Server error:', err);
    });
})();
```

#### Server Options

- `verbose` (boolean, default: `false`): Enables detailed logging (e.g., initialization, errors).
- `force` (boolean, default: `false`): Forces the removal of an existing active socket to create a new instance.

### Connecting a Client

The client connects to an existing server instance without managing its lifecycle.

```javascript
const ipc = require('unix-socket-ipc');

(async () => {
    const client = await ipc.connect('my-service', { verbose: true });
    if (!client) {
        console.log("Impossible de se connecter au serveur.");
        return; 
    }
    client.send({ hello: 'world' });
    client.listen((message) => {
        console.log('Client received:', message);
    });
    client.on('error', (err) => {
        console.error('Client error:', err);
    });
})();
```

#### Client Options

- `verbose` (boolean, default: `false`): Enables logging for client actions (e.g., connection success).

## Message Handling

Messages are sent as JSON objects, automatically serialized with `JSON.stringify()` and deserialized with `JSON.parse()`.

Large messages (exceeding 64KB by default) are split into chunks and reassembled transparently, ensuring seamless communication.

## Error Handling

The module emits `'error'` events with concise messages:

- **"Server name \"<name>\" instance is occupied"**: An active instance exists, and `force` is false.
- **"Server \"<name>\" does not exist"**: Client attempted to connect to a non-existent server.
- **"Instance not initialized"**: Attempted to send a message before server initialization.
- **"Not connected"**: Client tried to send a message without a successful connection.

### Handling Errors:

```javascript
server.on('error', (err) => console.error('Error:', err));
```

Errors are logged by default if `verbose: true` and no custom handler is provided, ensuring the application does not crash.

## API Reference

### `init(name, [options])`

Initializes a server instance.

- `name` (string): The name of the instance (e.g., `my-service` creates `/tmp/my-service.sock`).
- `options` (object, optional):
  - `verbose` (boolean): Enable logging.
  - `force` (boolean): Override an existing instance.

**Returns**: Promise resolving to the server instance.

### `connect(name, [options])`

Connects a client to an existing instance.

- `name` (string): The name of the instance to connect to.
- `options` (object, optional):
  - `verbose` (boolean): Enable logging.

**Returns**: Promise resolving to the client instance.

### Instance Methods

- `send(message)`: Sends a JSON message to the connected instance or clients.
- `listen(callback)`: Registers a callback to receive messages.
- `on('error', callback)`: Listens for error events.

## Limitations

- **Windows Support**: Not available due to reliance on Unix sockets.
- **Message Size**: Limited to 64KB chunks by default (configurable internally, not yet exposed in the API).
- **Instance Discovery**: The `discover()` method is rudimentary and only returns the current instance.

## Future Enhancements

- Add TCP fallback for Windows compatibility.
- Implement a robust instance discovery mechanism (e.g., a shared registry).
- Expose advanced options like `maxChunkSize` in the public API.

## Contributing

Contributions are welcome! Please submit issues or pull requests via the GitHub repository (once published).

## License

MIT

