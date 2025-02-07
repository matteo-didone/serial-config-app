const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { SerialPort } = require('serialport');

const store = new Store();
let mainWindow;
let serialPort = null;
let lastPortList = [];

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // In development, load from Vite dev server
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        // Open DevTools in development
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
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

// Serial port listing with change detection
async function getSerialPorts() {
    try {
        const ports = await SerialPort.list();
        const portList = ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || 'Unknown',
            vendorId: port.vendorId || 'Unknown',
            productId: port.productId || 'Unknown'
        }));

        const hasChanged = JSON.stringify(portList) !== JSON.stringify(lastPortList);
        if (hasChanged) {
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

// IPC Handlers
ipcMain.handle('get-serial-ports', async () => {
    return await getSerialPorts();
});

ipcMain.handle('connect-serial', async (event, portConfig) => {
    try {
        if (serialPort && serialPort.isOpen) {
            await new Promise((resolve, reject) => {
                serialPort.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        serialPort = new SerialPort({
            path: portConfig.path,
            baudRate: portConfig.baudRate || 9600,
            autoOpen: false
        });

        // Setup data handling for serial plotter
        serialPort.on('data', (data) => {
            try {
                // Assume CSV format for plotter data
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
            serialPort.open((err) => {
                if (err) {
                    reject({ success: false, error: err.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('disconnect-serial', async () => {
    try {
        if (serialPort && serialPort.isOpen) {
            await new Promise((resolve, reject) => {
                serialPort.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            return { success: true };
        }
        return { success: false, error: 'Port not connected' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('send-serial-data', (event, { data }) => {
    return new Promise((resolve, reject) => {
        if (!serialPort || !serialPort.isOpen) {
            resolve({ success: false, error: 'Serial port not connected' });
            return;
        }

        serialPort.write(data, (err) => {
            if (err) {
                console.error('Error writing to port:', err);
                resolve({ success: false, error: err.message });
            } else {
                resolve({ success: true, data });
            }
        });
    });
});

// Configuration management
ipcMain.handle('save-config', (event, config) => {
    try {
        const configs = store.get('configs', []);
        const newConfig = {
            ...config,
            id: Date.now().toString(),
            timestamp: new Date().toISOString()
        };

        configs.push(newConfig);
        store.set('configs', configs);
        return { success: true, config: newConfig };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-configs', () => {
    try {
        return store.get('configs', []);
    } catch (error) {
        console.error('Error loading configurations:', error);
        return [];
    }
});

ipcMain.handle('delete-config', (event, configId) => {
    try {
        const configs = store.get('configs', []);
        const newConfigs = configs.filter(config => config.id !== configId);
        store.set('configs', newConfigs);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('export-configs', (event, format = 'json') => {
    try {
        const configs = store.get('configs', []);
        return {
            success: true,
            data: JSON.stringify(configs, null, 2)
        };
    } catch (error) {
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
        return { success: false, error: error.message };
    }
});