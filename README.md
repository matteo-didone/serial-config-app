# Serial Configuration App

Una applicazione cross-platform per la configurazione di dispositivi tramite comunicazione seriale.

## Requisiti e Implementazione Dettagliata

### 1. Selezione della Porta Seriale
**Requisito:** L'app deve permettere all'utente di scegliere da un elenco di porte seriali disponibili e collegarsi a una di esse.

**Implementazione:**
```javascript
// Funzione di caricamento porte seriali
async function loadSerialPorts() {
    try {
        const ports = await ipcRenderer.invoke('get-serial-ports');
        const currentValue = elements.portSelect.value;
        elements.portSelect.innerHTML = '<option value="">Select port</option>';

        ports.forEach(port => {
            const option = document.createElement('option');
            option.value = port.path;
            option.textContent = `${port.path} (${port.manufacturer || 'Unknown'})`;
            if (port.vendorId) {
                option.textContent += ` [${port.vendorId}:${port.productId}]`;
            }
            elements.portSelect.appendChild(option);
        });

        // Mantiene la selezione se ancora disponibile
        if (currentValue && ports.some(p => p.path === currentValue)) {
            elements.portSelect.value = currentValue;
        }

        // Aggiorna info porta
        if (currentValue) {
            updatePortInfo(ports.find(p => p.path === currentValue));
        }
    } catch (error) {
        console.error('Error loading serial ports:', error);
    }
}

// Connessione alla porta
async function connectToPort() {
    const selectedPort = elements.portSelect.value;
    if (!selectedPort) {
        showToast('Select a port first', 'warning');
        return;
    }

    try {
        elements.connectButton.disabled = true;
        elements.connectionStatus.classList.remove('hidden');

        const result = await ipcRenderer.invoke('connect-serial', {
            path: selectedPort,
            baudRate: parseInt(elements.baudSelect.value)
        });

        handleConnectionResult(result);
    } catch (error) {
        showToast(`Connection failed: ${error.message}`, 'error');
    } finally {
        elements.connectButton.disabled = false;
        elements.connectionStatus.classList.add('hidden');
    }
}

// Auto-refresh delle porte ogni 15 secondi
loadSerialPorts();
portCheckInterval = setInterval(loadSerialPorts, 15000);
```

### 2. Inserimento Parametri e Validazione
**Requisito:** L'utente deve poter inserire una serie di valori numerici con vincoli specifici.

**Implementazione:**
```javascript
const UNSIGNED_LONG_MAX = 4294967295;

function validateInput(input, value) {
    const errors = {};

    // Gestione valori vuoti
    if (value === '' || value === null || value === undefined) {
        errors[input] = "Value is required";
        return errors[input];
    }

    // Conversione e validazione numero
    const numValue = Number(value);
    if (isNaN(numValue)) {
        errors[input] = "Must be a valid number";
        return errors[input];
    }

    // Verifica numero intero
    if (!Number.isInteger(numValue)) {
        errors[input] = "Must be an integer";
        return errors[input];
    }

    switch (input) {
        case 'channelsQty':
            if (numValue < 1 || numValue > 3) {
                errors[input] = "Channels must be between 1 and 3";
            }
            break;
        case 'fadeIn':
        case 'fadeOut':
        case 'onDuration':
        case 'offDuration':
        case 'offset':
        case 'startDelay':
            if (numValue < 0) {
                errors[input] = "Must be a positive number";
            } else if (numValue > UNSIGNED_LONG_MAX) {
                errors[input] = `Must be less than ${UNSIGNED_LONG_MAX}`;
            }
            break;
    }

    updateErrorState(input, errors[input]);
    return errors[input];
}

// Aggiunta validazione real-time
['channelsQty', 'fadeIn', 'fadeOut', 'onDuration', 'offDuration', 'offset', 'startDelay']
    .forEach(inputId => {
        elements[inputId].addEventListener('input', (e) => {
            validationErrors[inputId] = validateInput(inputId, e.target.value);
            updateSendButtonState();
        });
    });
```

### 3. Gestione della Flag "Always ON"
**Requisito:** Se "Always ON" è attivato, tutti i campi numerici (eccetto Channels' QTY) devono essere disabilitati.

**Implementazione:**
```javascript
elements.alwaysOn.addEventListener('change', () => {
    const disabled = elements.alwaysOn.checked;
    ['fadeIn', 'fadeOut', 'onDuration', 'offDuration', 'offset', 'startDelay']
        .forEach(field => {
            elements[field].disabled = disabled;
            if (disabled) {
                elements[field].value = '0';
                validationErrors[field] = null;
                updateSendButtonState();
            }
        });
    updateTimingVisualization();
});
```

### 4. Invio Dati via Seriale
**Requisito:** Invio dei dati in formato CSV con struttura specifica.

**Implementazione:**
```javascript
async function sendConfiguration() {
    const values = {
        program: parseInt(elements.program.value),
        channelsQty: parseInt(elements.channelsQty.value),
        fadeIn: parseInt(elements.fadeIn.value) || 0,
        fadeOut: parseInt(elements.fadeOut.value) || 0,
        onDuration: parseInt(elements.onDuration.value) || 0,
        offDuration: parseInt(elements.offDuration.value) || 0,
        offset: parseInt(elements.offset.value) || 0,
        startDelay: parseInt(elements.startDelay.value) || 0,
        alwaysOn: elements.alwaysOn.checked
    };

    // Validazione campi temporali
    const timeFields = ['fadeIn', 'fadeOut', 'onDuration', 'offDuration', 'offset', 'startDelay'];
    const invalidFields = timeFields.filter(field => {
        const value = values[field];
        return value < 0 || value > UNSIGNED_LONG_MAX;
    });

    if (invalidFields.length > 0) {
        showToast(`Invalid values in: ${invalidFields.join(', ')}`, 'error');
        return;
    }

    try {
        const result = await ipcRenderer.invoke('send-serial-data', values);
        if (result.success) {
            showToast('Configuration sent successfully', 'success');
            appendToSerialMonitor(result.data, 'sent');
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('Error sending configuration', 'error');
    }
}

// Gestiore invio da interfaccia
elements.sendButton.addEventListener('click', sendConfiguration);
```

### 5. Salvataggio e Caricamento delle Configurazioni
**Requisito:** L'utente deve poter salvare e ricaricare le configurazioni.

**Implementazione:**
```javascript
// Salvataggio configurazione
elements.saveConfigBtn.addEventListener('click', async () => {
    const name = elements.configNameInput.value.trim();
    if (!name) {
        showToast('Please enter a name', 'warning');
        return;
    }

    const values = {
        name,
        program: parseInt(elements.program.value),
        channelsQty: parseInt(elements.channelsQty.value),
        fadeIn: parseInt(elements.fadeIn.value) || 0,
        fadeOut: parseInt(elements.fadeOut.value) || 0,
        onDuration: parseInt(elements.onDuration.value) || 0,
        offDuration: parseInt(elements.offDuration.value) || 0,
        offset: parseInt(elements.offset.value) || 0,
        startDelay: parseInt(elements.startDelay.value) || 0,
        alwaysOn: elements.alwaysOn.checked
    };

    try {
        const result = await ipcRenderer.invoke('save-config', values);
        if (result.success) {
            showToast('Configuration saved', 'success');
            elements.saveConfigModal.close();
            await loadSavedConfigs();
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('Error saving configuration', 'error');
    }
});

// Caricamento configurazione
window.loadConfig = async function (configId) {
    try {
        const configs = await ipcRenderer.invoke('load-configs');
        const config = configs.find(c => c.id === configId);
        if (config) {
            elements.program.value = config.program;
            elements.channelsQty.value = config.channelsQty;
            elements.fadeIn.value = config.fadeIn;
            elements.fadeOut.value = config.fadeOut;
            elements.onDuration.value = config.onDuration;
            elements.offDuration.value = config.offDuration;
            elements.offset.value = config.offset;
            elements.startDelay.value = config.startDelay;
            elements.alwaysOn.checked = config.alwaysOn;

            elements.alwaysOn.dispatchEvent(new Event('change'));
            updateTimingVisualization();

            ['channelsQty', 'fadeIn', 'fadeOut', 'onDuration', 'offDuration', 'offset', 'startDelay']
                .forEach(inputId => {
                    validationErrors[inputId] = validateInput(inputId, elements[inputId].value);
                });

            updateSendButtonState();
            showToast('Configuration loaded', 'success');
        }
    } catch (error) {
        showToast('Error loading configuration', 'error');
    }
};
```

## Funzionalità Extra Implementate

### Visualizzazione Timing
La visualizzazione del timing usa un canvas HTML5 per disegnare il diagramma:

```javascript
function drawTimingDiagram(ctx, values, width, height) {
    const padding = 20;
    const totalTime = values.fadeIn + values.onDuration + values.fadeOut + values.offDuration || 1;

    ctx.beginPath();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--p');
    ctx.lineWidth = 2;

    // Punto di partenza
    ctx.moveTo(padding, height - padding);

    // Fade in
    ctx.lineTo(
        padding + (width - 2 * padding) * (values.fadeIn / totalTime),
        padding
    );

    // ON duration
    ctx.lineTo(
        padding + (width - 2 * padding) * ((values.fadeIn + values.onDuration) / totalTime),
        padding
    );

    // Fade out
    ctx.lineTo(
        padding + (width - 2 * padding) * ((values.fadeIn + values.onDuration + values.fadeOut) / totalTime),
        height - padding
    );

    // OFF duration
    ctx.lineTo(width - padding, height - padding);

    ctx.stroke();

    // Aggiunta labels
    ctx.font = '12px sans-serif';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bc');
    ctx.textAlign = 'center';

    if (values.fadeIn > 0) {
        ctx.fillText('Fade In', padding + (width - 2 * padding) * (values.fadeIn / totalTime / 2), height - 5);
    }
    if (values.onDuration > 0) {
        ctx.fillText('ON', padding + (width - 2 * padding) * ((values.fadeIn + values.onDuration / 2) / totalTime), padding - 5);
    }
}
```

### Monitor Seriale
```javascript
function appendToSerialMonitor(message, type = 'received') {
    const div = document.createElement('div');
    div.className = `my-1 ${type === 'sent' ? 'text-primary' : 'text-success'}`;
    div.textContent = `${new Date().toLocaleTimeString()} ${type === 'sent' ? '>> ' : '<< '}${message}`;
    elements.serialMonitor.appendChild(div);

    if (elements.autoScrollToggle.checked) {
        elements.serialMonitor.scrollTop = elements.serialMonitor.scrollHeight;
    }
}

// Controlli monitor
elements.clearMonitorBtn.addEventListener('click', () => {
    elements.serialMonitor.innerHTML = '';
});

elements.monitorToggle.addEventListener('change', async () => {
    try {
        const result = await ipcRenderer.invoke('toggle-serial-monitor', elements.monitorToggle.checked);
        if (!result.success) {
            showToast('Failed to toggle serial monitor', 'error');
        }
    } catch (error) {
        showToast('Error toggling serial monitor', 'error');
    }
});
```

### Sistema di Notifiche Toast
```javascript
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastItem = document.createElement('div');
    toastItem.className = `alert alert-${type} fade-in`;
    toastItem.innerHTML = `<span>${message}</span>`;
    toast.appendChild(toastItem);

    setTimeout(() => {
        toastItem.style.opacity = '0';
        setTimeout(() => toast.removeChild(toastItem), 300);
    }, 3000);
}
```

### Shortcut da Tastiera
```javascript
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 's':
                e.preventDefault();
                if (!elements.sendButton.disabled) {
                    elements.sendButton.click();
                }
                break;
            case 'b':
                e.preventDefault();
                elements.saveConfigBtn.click();
                break;
            case 'k':
                e.preventDefault();
                elements.clearMonitorBtn.click();
                break;
        }
    }
});
```

## Note Tecniche
- L'applicazione è strutturata con un'architettura main-renderer tipica di Electron
- La comunicazione IPC è usata per operazioni asincrone come:
  - Comunicazione seriale
  - Gestione configurazioni
  - Operazioni sul filesystem
- Il tema chiaro/scuro è implementato usando DaisyUI e persiste tra le sessioni
- La validazione dei dati avviene sia lato renderer che lato main per massima sicurezza

## Requisiti Hardware
- Porta seriale (fisica o virtuale)
- Dispositivo compatibile con il protocollo di comunicazione
- Sistema operativo Windows o macOS

## Requisiti Software
- Node.js
- npm
- Electron
- serialport
- Tailwind CSS e DaisyUI per l'interfaccia

## Struttura IPC (Main Process)
La comunicazione tra il processo main e renderer è gestita attraverso questi handler:

```javascript
// Gestione delle porte seriali
ipcMain.handle('get-serial-ports', async () => {
    try {
        const ports = await SerialPort.list();
        return ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || 'Unknown',
            vendorId: port.vendorId || 'Unknown',
            productId: port.productId || 'Unknown'
        }));
    } catch (error) {
        console.error('Error listing serial ports:', error);
        return [];
    }
});

// Connessione seriale
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
                    resolve({ success: true });
                }
            });
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Invio dati seriali
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
                resolve({ success: true, data: csvString });
            }
        });
    });
});

// Gestione configurazioni
ipcMain.handle('save-config', (event, config) => {
    try {
        const configs = store.get('configs', []);

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

// Import/Export
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
```

## Gestione Errori
L'applicazione implementa una gestione degli errori a più livelli:

1. **Validazione Input**
   - Controllo real-time dei valori inseriti
   - Validazione dei limiti numerici
   - Feedback visuale immediato

2. **Comunicazione Seriale**
   - Gestione errori di connessione
   - Timeout e riconnessione automatica
   - Feedback sullo stato della connessione

3. **Gestione Configurazioni**
   - Validazione prima del salvataggio
   - Controllo integrità dei dati importati
   - Backup automatico delle configurazioni

4. **UI/UX**
   - Toast notifications per feedback
   - Disabilitazione elementi UI quando non disponibili
   - Messaggi di errore chiari e specifici

## Performance Optimizations
- Throttling dei controlli porta seriale (15s)
- Debouncing degli input numerici
- Lazy loading delle configurazioni salvate
- Utilizzo di requestAnimationFrame per la visualizzazione timing
- Event delegation per gli handler degli eventi

## Testing
Istruzioni per testare le funzionalità principali:

1. **Test Connessione Seriale**
   ```bash
   # Test con dispositivo virtuale
   socat -d -d PTY PTY
   ```

2. **Test Validazione**
   - Inserire valori limite per unsigned long
   - Provare valori negativi
   - Testare caratteri non numerici

3. **Test Configurazioni**
   - Salvare multiple configurazioni
   - Importare/esportare
   - Verificare persistenza dopo riavvio

4. **Test Interfaccia**
   - Verificare responsive design
   - Testare tema chiaro/scuro
   - Controllare keyboard shortcuts

## Deployment
1. **Build**
   ```bash
   npm run build
   ```

2. **Package**
   ```bash
   npm run package
   ```

3. **Distribution**
   ```bash
   npm run make
   ```