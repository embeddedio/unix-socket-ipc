const ipc = require('../index.js'); // Assuming this is your module path
const assert = require('assert');

// Test suite
(async () => {
    console.log('Starting sockunix2 tests...');

    // Test 1: Server-Client Communication
    console.log('Test 1: Server-Client Communication');
    const server1 = await ipc.init('test-service', { verbose: true, force: true });
    server1.listen((msg) => {
        assert.deepStrictEqual(msg, { test: 'ping' }, 'Server received incorrect message');
        server1.send({ reply: 'pong' });
        console.log('Server received:', msg);
    });

    const client1 = await ipc.connect('test-service', { verbose: true });
    client1.send({ test: 'ping' });
    client1.listen((msg) => {
        assert.deepStrictEqual(msg, { reply: 'pong' }, 'Client received incorrect reply');
        console.log('Client received:', msg);
    });

    // Wait briefly to ensure Test 1 completes
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Occupied Instance Handling
    console.log('Test 2: Occupied Instance Handling');
    let test2_error = false;

    try {
        // Attempt to initialize a second server with the same name
        const firstServer = await ipc.init('test-service', { verbose: true });
        
        // Second initialization should throw an error
        try {
            const secondServer = await ipc.init('test-service', { verbose: true });
            await new Promise(resolve => setTimeout(resolve, 1000));  // Ensure error happens before this
            test2_error = true;
        } catch (err) {
            console.log('Expected error on duplicate instance:', err.message);
            test2_error = false;
            assert.strictEqual(err.message, 'Server name "test-service" instance is occupied', 'Unexpected error message');
        }

    } catch (err) {
        console.log('Unexpected error during server initialization:', err);
    }
    console.log('test2_error:', test2_error);
    assert.ok(test2_error, 'Error not thrown for occupied instance');

    // Test 3: Client Connecting to Non-Existent Server
    console.log('Test 3: Client Connecting to Non-Existent Server');
    let clientErrorCaught = true;

    try {
        const client2 = await ipc.connect('non-existent-service', { verbose: true });
        client2.on('error', (err) => {
            console.log('Client error event triggered:', err);
            assert.strictEqual(err, 'Server "non-existent-service" does not exist', 'Unexpected client error message');
            clientErrorCaught = false;
        });

        // Wait longer to ensure error is emitted
        await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
        console.log('Unexpected error connecting to non-existent server:', err);
    }

    assert.ok(clientErrorCaught, 'Error not emitted for non-existent server');

    console.log('All tests passed!');
})();
