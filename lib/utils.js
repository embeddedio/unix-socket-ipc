const fs = require('fs');
const { SOCKET_BASE_PATH, PERMISSIONS } = require('./constants');

function getSocketPath(name) {
    return `${SOCKET_BASE_PATH}/${name}.sock`;
}

function cleanupSocket(socketPath) {
    if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
        return true;
    }
    return false;
}

function setSocketPermissions(socketPath) {
    fs.chmodSync(socketPath, PERMISSIONS);
}

function log(verbose, message) {
    if (verbose) {
        console.log(message);
    }
}

module.exports = {
    getSocketPath,
    cleanupSocket,
    setSocketPermissions,
    log
};