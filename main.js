const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');

let store;
let mainWindow;
let serialPort = null;
let lastPortList = [];

// Importa electron-store in modo dinamico
async function initStore() {
    const Store = (await import('electron-store')).default;
    store = new Store({ projectName: "serial-config-app" });
}

async function createWindow() {
    await initStore();

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false
        }
    });

    // Set Content Security Policy
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
                ]
            }
        });
    });

    if (process.env.NODE_ENV === 'development') {
        console.log('Loading development URL...');
        mainWindow.loadURL('http://localhost:5173').catch(err => {
            console.error('Failed to load development URL:', err);
        });
        mainWindow.webContents.openDevTools();
    } else {
        console.log('Loading production file...');
        mainWindow.loadFile(path.join(__dirname, 'dist/index.html')).catch(err => {
            console.error('Failed to load production file:', err);
        });
    }

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Funzione per ottenere le porte seriali
async function getSerialPorts() {
    try {
        const ports = await SerialPort.list();
        const portList = ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || 'Unknown',
            vendorId: port.vendorId || 'Unknown',
            productId: port.productId || 'Unknown'
        }));

        if (JSON.stringify(portList) !== JSON.stringify(lastPortList)) {
            lastPortList = portList;
            if (mainWindow) {
                mainWindow.webContents.send('ports-changed', portList);
            }
        }
        return portList;
    } catch (error) {
        console.error('Error listing serial ports:', error);
        return [];
    }
}

// Handlers IPC
ipcMain.handle('get-serial-ports', async () => {
    try {
        const ports = await getSerialPorts();
        return { success: true, data: ports };
    } catch (error) {
        console.error('Error in get-serial-ports:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('connect-serial', async (event, portConfig) => {
    try {
        if (serialPort && serialPort.isOpen) {
            await new Promise((resolve, reject) => {
                serialPort.close(err => (err ? reject(err) : resolve()));
            });
        }

        serialPort = new SerialPort({
            path: portConfig.path,
            baudRate: portConfig.baudRate || 9600,
            autoOpen: false
        });

        serialPort.on('data', (data) => {
            try {
                const values = data.toString().trim().split(',');
                if (values.length === 3) {
                    mainWindow.webContents.send('plotter-data', {
                        channel1: parseInt(values[0]),
                        channel2: parseInt(values[1]),
                        channel3: parseInt(values[2])
                    });
                }
            } catch (error) {
                console.error('Error parsing plotter data:', error);
            }
        });

        return new Promise((resolve, reject) => {
            serialPort.open(err => {
                if (err) {
                    console.error('Error opening serial port:', err);
                    reject({ success: false, error: err.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    } catch (error) {
        console.error('Error in connect-serial:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('disconnect-serial', async () => {
    try {
        if (serialPort && serialPort.isOpen) {
            await new Promise((resolve, reject) => {
                serialPort.close(err => (err ? reject(err) : resolve()));
            });
            return { success: true };
        }
        return { success: false, error: 'Port not connected' };
    } catch (error) {
        console.error('Error in disconnect-serial:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('send-serial-data', (event, { data }) => {
    return new Promise((resolve) => {
        if (!serialPort || !serialPort.isOpen) {
            resolve({ success: false, error: 'Serial port not connected' });
            return;
        }

        serialPort.write(data, err => {
            if (err) {
                console.error('Error writing to serial port:', err);
                resolve({ success: false, error: err.message });
            } else {
                resolve({ success: true, data });
            }
        });
    });
});

// Configurazione e gestione dei file di configurazione
ipcMain.handle('save-config', (event, config) => {
    try {
        const configs = store.get('configs', []);
        const newConfig = {
            ...config,
            id: Date.now().toString(),
            timestamp: new Date().toISOString()
        };
        store.set('configs', [...configs, newConfig]);
        return { success: true, config: newConfig };
    } catch (error) {
        console.error('Error in save-config:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-configs', () => {
    try {
        return { success: true, data: store.get('configs', []) };
    } catch (error) {
        console.error('Error in load-configs:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-config', (event, configId) => {
    try {
        const configs = store.get('configs', []);
        store.set('configs', configs.filter(config => config.id !== configId));
        return { success: true };
    } catch (error) {
        console.error('Error in delete-config:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('export-configs', () => {
    try {
        return {
            success: true,
            data: JSON.stringify(store.get('configs', []), null, 2)
        };
    } catch (error) {
        console.error('Error in export-configs:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('import-configs', (event, data) => {
    try {
        const configs = JSON.parse(data);
        if (!Array.isArray(configs)) {
            throw new Error('Invalid configuration format');
        }
        store.set('configs', configs);
        return { success: true };
    } catch (error) {
        console.error('Error in import-configs:', error);
        return { success: false, error: error.message };
    }
});