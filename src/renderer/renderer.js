const { ipcRenderer } = require('electron');

// UI Elements
const elements = {
    // Connection elements
    portSelect: document.getElementById('portSelect'),
    baudSelect: document.getElementById('baudSelect'),
    connectButton: document.getElementById('connectButton'),
    connectionStatus: document.getElementById('connectionStatus'),
    portInfo: document.getElementById('portInfo'),
    testConnectionBtn: document.getElementById('testConnectionBtn'),

    // Form inputs
    program: document.getElementById('program'),
    channelsQty: document.getElementById('channelsQty'),
    fadeIn: document.getElementById('fadeIn'),
    fadeOut: document.getElementById('fadeOut'),
    onDuration: document.getElementById('onDuration'),
    offDuration: document.getElementById('offDuration'),
    offset: document.getElementById('offset'),
    startDelay: document.getElementById('startDelay'),
    alwaysOn: document.getElementById('alwaysOn'),

    // Action buttons
    sendButton: document.getElementById('sendButton'),
    saveConfigBtn: document.getElementById('saveConfigBtn'),

    // Configuration management
    savedConfigs: document.getElementById('savedConfigs'),
    saveConfigModal: document.getElementById('saveConfigModal'),
    configNameInput: document.getElementById('configNameInput'),
    saveConfirmBtn: document.getElementById('saveConfirmBtn'),
    saveCancelBtn: document.getElementById('saveCancelBtn'),
    importConfigBtn: document.getElementById('importConfigBtn'),
    exportConfigBtn: document.getElementById('exportConfigBtn'),
    importExportModal: document.getElementById('importExportModal'),
    importExportText: document.getElementById('importExportText'),
    importExportConfirmBtn: document.getElementById('importExportConfirmBtn'),
    importExportCancelBtn: document.getElementById('importExportCancelBtn'),

    // Delete confirmation
    deleteConfirmModal: document.getElementById('deleteConfirmModal'),
    deleteConfirmBtn: document.getElementById('deleteConfirmBtn'),
    deleteCancelBtn: document.getElementById('deleteCancelBtn'),

    // Serial monitor
    serialMonitor: document.getElementById('serialMonitor'),
    clearMonitorBtn: document.getElementById('clearMonitorBtn'),
    autoScrollToggle: document.getElementById('autoScrollToggle'),
    monitorToggle: document.getElementById('monitorToggle'),
    serialInput: document.getElementById('serialInput'),
    sendSerialBtn: document.getElementById('sendSerialBtn'),

    // Theme toggle
    themeToggle: document.getElementById('themeToggle'),

    // Timing visualization
    timingVisualization: document.getElementById('timingVisualization')
};

// Modal and drawer elements
const modals = {
    importExport: elements.importExportModal,
    saveConfig: elements.saveConfigModal,
    deleteConfirm: elements.deleteConfirmModal
};

// Drawer elements
const drawer = {
    toggle: document.getElementById('drawer-toggle'),
    side: document.querySelector('.drawer-side'),
    overlay: document.querySelector('.drawer-overlay'),
    mobileHeader: document.querySelector('.lg\\:hidden')
};

const UNSIGNED_LONG_MAX = 4294967295;

// Aggiungi all'inizio del file, dopo la definizione di drawer
const overlay = document.querySelector('.drawer-overlay');
const drawerToggle = document.getElementById('drawer-toggle');

// Aggiungi l'event listener per chiudere il menu cliccando l'overlay
overlay.addEventListener('click', () => {
    drawerToggle.checked = false;
});

// Aggiungi anche la gestione del tasto ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerToggle.checked) {
        drawerToggle.checked = false;
    }
});

// State management
let validationErrors = {};
let deleteConfigId = null;
let isImporting = false;

// Theme management
elements.themeToggle.addEventListener('change', () => {
    const theme = elements.themeToggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
});

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'light';
elements.themeToggle.checked = savedTheme === 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Modal handlers
elements.saveCancelBtn.addEventListener('click', () => {
    modals.saveConfig.close();
});

elements.importExportCancelBtn.addEventListener('click', () => {
    modals.importExport.close();
});

elements.deleteCancelBtn.addEventListener('click', () => {
    modals.deleteConfirm.close();
});

// Drawer handlers
drawer.overlay.addEventListener('click', () => {
    drawer.toggle.checked = false;
});

// Global modal and drawer close on ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        modals.importExport.close();
        modals.saveConfig.close();
        modals.deleteConfirm.close();
        drawer.toggle.checked = false;
    }
});

// Form validation functions
function validateInput(input, value) {
    const errors = {};

    // Handle empty values
    if (value === '' || value === null || value === undefined) {
        errors[input] = "Value is required";
        return errors[input];
    }

    // Convert to number and check if it's valid
    const numValue = Number(value);
    if (isNaN(numValue)) {
        errors[input] = "Must be a valid number";
        return errors[input];
    }

    // Check if it's an integer
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

// Helper function to format large numbers with comma separators
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


// Update error display with better formatting
function updateErrorState(input, error) {
    const errorElement = document.getElementById(`${input}Error`);
    if (errorElement) {
        if (error && error.includes(UNSIGNED_LONG_MAX.toString())) {
            // Format the max value in the error message for better readability
            error = error.replace(UNSIGNED_LONG_MAX.toString(), formatNumber(UNSIGNED_LONG_MAX));
        }
        errorElement.textContent = error || '';
        errorElement.classList.toggle('hidden', !error);
        elements[input].classList.toggle('input-error', !!error);
    }
}

// Add real-time validation to all numeric inputs
['channelsQty', 'fadeIn', 'fadeOut', 'onDuration', 'offDuration', 'offset', 'startDelay'].forEach(inputId => {
    elements[inputId].addEventListener('input', (e) => {
        validationErrors[inputId] = validateInput(inputId, e.target.value);
        updateSendButtonState();
    });
});

function updateSendButtonState() {
    const hasErrors = Object.values(validationErrors).some(error => error);
    elements.sendButton.disabled = hasErrors;
}

// Toast notification system
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

// Serial monitor management
function appendToSerialMonitor(message, type = 'received') {
    const div = document.createElement('div');
    div.className = `my-1 ${type === 'sent' ? 'text-primary' : 'text-success'}`;
    div.textContent = `${new Date().toLocaleTimeString()} ${type === 'sent' ? '>> ' : '<< '}${message}`;
    elements.serialMonitor.appendChild(div);

    if (elements.autoScrollToggle.checked) {
        elements.serialMonitor.scrollTop = elements.serialMonitor.scrollHeight;
    }
}

// Serial monitor controls
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

// Serial port connection management
let portCheckInterval;

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

        // Restore selection if still available
        if (currentValue && ports.some(p => p.path === currentValue)) {
            elements.portSelect.value = currentValue;
        }

        // Update port info
        if (currentValue) {
            const selectedPort = ports.find(p => p.path === currentValue);
            if (selectedPort) {
                elements.portInfo.innerHTML = `
                    <div>Manufacturer: ${selectedPort.manufacturer || 'Unknown'}</div>
                    <div>Vendor ID: ${selectedPort.vendorId || 'Unknown'}</div>
                    <div>Product ID: ${selectedPort.productId || 'Unknown'}</div>
                `;
                elements.portInfo.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error loading serial ports:', error);
    }
}

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

function handleConnectionResult(result) {
    if (result.success) {
        showToast('Connected successfully', 'success');
        elements.connectButton.textContent = 'Connected';
        elements.connectButton.classList.add('btn-success');
        elements.sendButton.disabled = false;
        elements.sendSerialBtn.disabled = false;
        elements.testConnectionBtn.disabled = false;
    } else {
        showToast(result.error || 'Connection failed', 'error');
        elements.connectButton.disabled = false;
        elements.connectButton.classList.remove('btn-success');
    }
}

// Connect button handler
elements.connectButton.addEventListener('click', connectToPort);

// Handle serial input
elements.serialInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendSerialCommand();
    }
});

elements.sendSerialBtn.addEventListener('click', sendSerialCommand);

async function sendSerialCommand() {
    const command = elements.serialInput.value.trim();
    if (!command) return;

    try {
        const result = await ipcRenderer.invoke('send-serial-data', { command });
        if (result.success) {
            appendToSerialMonitor(command, 'sent');
            elements.serialInput.value = '';
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('Error sending command', 'error');
    }
}

// Initialize port listing with reduced frequency
loadSerialPorts();
portCheckInterval = setInterval(loadSerialPorts, 15000); // Check every 15 seconds

// Timing visualization
function updateTimingVisualization() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const container = elements.timingVisualization;
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size accounting for device pixel ratio
    canvas.width = container.offsetWidth * dpr;
    canvas.height = container.offsetHeight * dpr;
    canvas.style.width = container.offsetWidth + 'px';
    canvas.style.height = container.offsetHeight + 'px';
    ctx.scale(dpr, dpr);

    container.innerHTML = '';
    container.appendChild(canvas);

    const values = {
        fadeIn: parseInt(elements.fadeIn.value) || 0,
        fadeOut: parseInt(elements.fadeOut.value) || 0,
        onDuration: parseInt(elements.onDuration.value) || 0,
        offDuration: parseInt(elements.offDuration.value) || 0,
        alwaysOn: elements.alwaysOn.checked
    };

    if (values.alwaysOn) {
        drawAlwaysOnState(ctx, canvas.width / dpr, canvas.height / dpr);
        return;
    }

    drawTimingDiagram(ctx, values, canvas.width / dpr, canvas.height / dpr);
}

function drawAlwaysOnState(ctx, width, height) {
    const padding = 20;

    ctx.beginPath();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--p');
    ctx.lineWidth = 2;

    // Draw a straight line at max brightness
    ctx.moveTo(padding, padding);
    ctx.lineTo(width - padding, padding);

    ctx.stroke();
}

function drawTimingDiagram(ctx, values, width, height) {
    const padding = 20;
    const totalTime = values.fadeIn + values.onDuration + values.fadeOut + values.offDuration || 1;

    ctx.beginPath();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--p');
    ctx.lineWidth = 2;

    // Start point
    ctx.moveTo(padding, height - padding);

    // Fade in
    ctx.lineTo(
        padding + (width - 2 * padding) * (values.fadeIn / totalTime),
        padding
    );

    // On duration
    ctx.lineTo(
        padding + (width - 2 * padding) * ((values.fadeIn + values.onDuration) / totalTime),
        padding
    );

    // Fade out
    ctx.lineTo(
        padding + (width - 2 * padding) * ((values.fadeIn + values.onDuration + values.fadeOut) / totalTime),
        height - padding
    );

    // Off duration
    ctx.lineTo(width - padding, height - padding);

    ctx.stroke();

    // Add labels
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

// Add timing visualization update to input events
['fadeIn', 'fadeOut', 'onDuration', 'offDuration'].forEach(inputId => {
    elements[inputId].addEventListener('input', updateTimingVisualization);
});

// Configuration form handling
elements.alwaysOn.addEventListener('change', () => {
    const disabled = elements.alwaysOn.checked;
    ['fadeIn', 'fadeOut', 'onDuration', 'offDuration', 'offset', 'startDelay'].forEach(field => {
        elements[field].disabled = disabled;
        if (disabled) {
            elements[field].value = '0';
            validationErrors[field] = null;
            updateSendButtonState();
        }
    });
    updateTimingVisualization();
});

// Test connection button
elements.testConnectionBtn.addEventListener('click', async () => {
    try {
        const result = await ipcRenderer.invoke('send-serial-data', {
            program: 1,
            fadeIn: 100,
            fadeOut: 100,
            onDuration: 100,
            offDuration: 100,
            offset: 0,
            startDelay: 0,
            channelsQty: 1,
            alwaysOn: false
        });

        if (result.success) {
            showToast('Test successful', 'success');
        } else {
            showToast('Test failed: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Test failed', 'error');
    }
});

// Send configuration
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

    // Validate all values are within unsigned long range
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

elements.sendButton.addEventListener('click', sendConfiguration);

// Save configuration handling
elements.saveConfigBtn.addEventListener('click', () => {
    elements.saveConfigModal.showModal();
    elements.configNameInput.value = '';
    elements.configNameInput.focus();
});

elements.saveConfirmBtn.addEventListener('click', async () => {
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

// Import/Export handling
elements.exportConfigBtn.addEventListener('click', async () => {
    try {
        const result = await ipcRenderer.invoke('export-configs');
        if (result.success) {
            const configs = JSON.parse(result.data);
            const csvContent = configs.map(config =>
                `CFG,${config.program},${config.fadeIn},${config.fadeOut},` +
                `${config.onDuration},${config.offDuration},${config.offset},` +
                `${config.startDelay},${config.channelsQty},${config.alwaysOn ? 1 : 0}`
            ).join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'serial-configs.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast('Configurations exported successfully', 'success');
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('Error exporting configurations', 'error');
    }
});

// Funzione di import modificata
elements.importConfigBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const csvLines = e.target.result.split('\n');
                    const configs = csvLines.map(line => {
                        const [prefix, program, fadeIn, fadeOut, onDuration,
                            offDuration, offset, startDelay, channelsQty, alwaysOn] = line.split(',');

                        if (prefix !== 'CFG') {
                            throw new Error('Invalid file format');
                        }

                        return {
                            program: parseInt(program),
                            fadeIn: parseInt(fadeIn),
                            fadeOut: parseInt(fadeOut),
                            onDuration: parseInt(onDuration),
                            offDuration: parseInt(offDuration),
                            offset: parseInt(offset),
                            startDelay: parseInt(startDelay),
                            channelsQty: parseInt(channelsQty),
                            alwaysOn: parseInt(alwaysOn) === 1
                        };
                    });

                    const result = await ipcRenderer.invoke('import-configs', JSON.stringify(configs));
                    if (result.success) {
                        showToast('Configurations imported successfully', 'success');
                        await loadSavedConfigs();
                    } else {
                        showToast(result.error, 'error');
                    }
                } catch (error) {
                    showToast('Invalid file format', 'error');
                }
            };
            reader.readAsText(file);
        }
    };

    input.click();
});

// Delete configuration handling
function showDeleteConfirmation(configId) {
    deleteConfigId = configId;
    elements.deleteConfirmModal.showModal();
}

elements.deleteConfirmBtn.addEventListener('click', async () => {
    if (!deleteConfigId) return;

    try {
        const result = await ipcRenderer.invoke('delete-config', deleteConfigId);
        if (result.success) {
            showToast('Configuration deleted', 'success');
            await loadSavedConfigs();
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('Error deleting configuration', 'error');
    }

    elements.deleteConfirmModal.close();
    deleteConfigId = null;
});

// Load configurations into UI
async function loadSavedConfigs() {
    try {
        const configs = await ipcRenderer.invoke('load-configs');
        elements.savedConfigs.innerHTML = '';

        if (configs.length === 0) {
            elements.savedConfigs.innerHTML = `
                <div class="text-center text-gray-500 p-4">
                    No saved configurations
                </div>
            `;
            return;
        }

        configs.forEach(config => {
            const configCard = document.createElement('div');
            configCard.className = 'card bg-base-100 shadow-sm mb-4';
            configCard.innerHTML = `
                <div class="card-body p-4">
                    <h3 class="card-title text-lg">${config.name}</h3>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div>Program: ${['A', 'B', 'C'][config.program - 1]}</div>
                        <div>Channels: ${config.channelsQty}</div>
                        ${!config.alwaysOn ? `
                            <div>Fade In: ${config.fadeIn}ms</div>
                            <div>Fade Out: ${config.fadeOut}ms</div>
                            <div>ON Duration: ${config.onDuration}ms</div>
                            <div>OFF Duration: ${config.offDuration}ms</div>
                            <div>Offset: ${config.offset}ms</div>
                            <div>Start Delay: ${config.startDelay}ms</div>
                        ` : ''}
                        <div>Always ON: ${config.alwaysOn ? 'Yes' : 'No'}</div>
                    </div>
                    <div class="card-actions justify-end mt-4">
                        <button class="btn btn-sm btn-primary" onclick="loadConfig('${config.id}')">Load</button>
                        <button class="btn btn-sm btn-ghost" onclick="showDeleteConfirmation('${config.id}')">Delete</button>
                    </div>
                </div>
            `;
            elements.savedConfigs.appendChild(configCard);
        });
    } catch (error) {
        showToast('Error loading configurations', 'error');
    }
}

// Global load config function
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

            ['channelsQty', 'fadeIn', 'fadeOut', 'onDuration', 'offDuration', 'offset', 'startDelay'].forEach(inputId => {
                validationErrors[inputId] = validateInput(inputId, elements[inputId].value);
            });

            updateSendButtonState();
            showToast('Configuration loaded', 'success');
        }
    } catch (error) {
        showToast('Error loading configuration', 'error');
    }
};

// Event listeners for IPC events
ipcRenderer.on('serial-data', (event, data) => {
    appendToSerialMonitor(data);
});

ipcRenderer.on('serial-error', (event, error) => {
    showToast(error, 'error');
});

ipcRenderer.on('ports-changed', (event, ports) => {
    loadSerialPorts();
});

// Keyboard shortcuts
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

// Initialize
loadSavedConfigs();
updateTimingVisualization();

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
    clearInterval(portCheckInterval);
});