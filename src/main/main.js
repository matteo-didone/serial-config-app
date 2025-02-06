const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { SerialPort } = require('serialport');

const store = new Store();
let mainWindow;
let serialPort = null;
let lastPortList = [];
let serialMonitorActive = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
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

// Improved serial port listing with change detection
async function getSerialPorts() {
    try {
        const ports = await SerialPort.list();
        const portList = ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || 'Unknown',
            vendorId: port.vendorId || 'Unknown',
            productId: port.productId || 'Unknown'
        }));

        // Check if the port list has changed
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

// Serial port listing
ipcMain.handle('get-serial-ports', async () => {
    return await getSerialPorts();
});

// Enhanced serial connection with auto-reconnect
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

        return new Promise((resolve, reject) => {
            serialPort.open((err) => {
                if (err) {
                    reject({ success: false, error: err.message });
                } else {
                    // Setup data monitoring
                    if (serialMonitorActive) {
                        serialPort.on('data', (data) => {
                            mainWindow.webContents.send('serial-data', data.toString());
                        });
                    }

                    // Setup error handling
                    serialPort.on('error', (err) => {
                        mainWindow.webContents.send('serial-error', err.message);
                    });

                    resolve({ success: true });
                }
            });
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Serial monitor control
ipcMain.handle('toggle-serial-monitor', (event, enabled) => {
    serialMonitorActive = enabled;
    if (serialPort && serialPort.isOpen) {
        if (enabled) {
            serialPort.on('data', (data) => {
                mainWindow.webContents.send('serial-data', data.toString());
            });
        } else {
            serialPort.removeAllListeners('data');
        }
    }
    return { success: true, enabled: serialMonitorActive };
});

// Enhanced serial data sending with validation
ipcMain.handle('send-serial-data', (event, data) => {
    return new Promise((resolve, reject) => {
        if (!serialPort || !serialPort.isOpen) {
            resolve({ success: false, error: 'Serial port not connected' });
            return;
        }

        const csvString = `CFG,${data.program},${data.fadeIn},${data.fadeOut},${data.onDuration},` +
            `${data.offDuration},${data.offset},${data.startDelay},${data.channelsQty},${data.alwaysOn ? 1 : 0}\n`;

        serialPort.write(csvString, (err) => {
            if (err) {
                console.error('Error writing to port:', err);
                resolve({ success: false, error: err.message });
            } else {
                console.log('Data sent successfully:', csvString);
                resolve({ success: true, data: csvString });
            }
        });
    });
});

// Configuration management with validation
ipcMain.handle('save-config', (event, config) => {
    try {
        const configs = store.get('configs', []);

        // Validate configuration before saving
        if (!config.name || !config.program || config.channelsQty < 1 || config.channelsQty > 3) {
            throw new Error('Invalid configuration data');
        }

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

// Export configurations
ipcMain.handle('export-configs', (event, format = 'json') => {
    try {
        const configs = store.get('configs', []);
        if (format === 'json') {
            return {
                success: true,
                data: JSON.stringify(configs, null, 2)
            };
        }
        return { success: false, error: 'Unsupported format' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Import configurations
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