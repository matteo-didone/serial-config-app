# Serial Configuration App

## 📑 Panoramica
Un'applicazione desktop per la configurazione e il monitoraggio di dispositivi seriali, sviluppata usando Electron e React. L'applicazione implementa una serie di requisiti specifici per la comunicazione seriale e la gestione di configurazioni.

## 🌳 Branch
- **main**: Versione iniziale del progetto
- **react-implementation**: Implementazione completa con React + Electron

## 🚀 Come Iniziare

### Prerequisiti
- Node.js (v18+)
- npm o yarn
- Git

### Setup
```bash
# Clona il repository
git clone https://github.com/matteo-didone/serial-config-app.git
cd serial-config-app

# Passa al branch react-implementation
git checkout react-implementation

# Installa le dipendenze
npm install

# Avvia in modalità sviluppo
npm run dev:electron
```

## 💡 Implementazione dei Requisiti

### 1. Gestione Porte Seriali

#### Requisito:
- Elenco porte disponibili
- Connessione/disconnessione
- Aggiornamento automatico

#### Implementazione:
```javascript
// main.js - Backend seriale
const serialHelpers = {
    async listPorts() {
        const ports = await SerialPort.list();
        return ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || 'Unknown',
            vendorId: port.vendorId || 'Unknown',
            productId: port.productId || 'Unknown'
        }));
    }
};

// ConnectionManager.jsx - Frontend
export function ConnectionManager({ onConnectionChange }) {
    const [serialPorts, setSerialPorts] = useState([]);
    
    // Polling automatico delle porte
    useEffect(() => {
        const loadPorts = async () => {
            const result = await ipcRenderer.invoke("get-serial-ports");
            setSerialPorts(result.data);
        };
        
        loadPorts();
        const interval = setInterval(loadPorts, 5000);
        return () => clearInterval(interval);
    }, []);
    
    // ... UI per selezione e connessione
}
```

### 2. Parametri e Validazione

#### Requisito:
- Validazione parametri temporali
- Gestione stati forzati
- Conversione unità di misura

#### Implementazione:
```javascript
// App.jsx - Gestione form e validazione
const UNSIGNED_LONG_MAX = 4294967295;

function App() {
    const [formData, setFormData] = useState({
        program: "1",          // A=1, B=2, C=3
        channelsQty: "1",      // 1-3
        fadeIn: "0",          // secondi → millisecondi
        fadeOut: "0",
        onDuration: "0",
        offDuration: "0",
        offset: "0",
        startDelay: "0",
        maxBrightness: 100,   // 1-100%
        forceStatus: "0",     // None=0, ON=1, OFF=2
        targetChannel: "0"    // All=0, CH1=1, CH2=2, CH3=3
    });

    // Validazione complessa con gestione errori
    const validateField = (field, value) => {
        const numValue = Number(value);
        const timeFields = ["fadeIn", "fadeOut", "onDuration", 
                          "offDuration", "offset", "startDelay"];
        
        if (timeFields.includes(field)) {
            // Conversione secondi → millisecondi per validazione
            const msValue = numValue * 1000;
            return msValue >= 0 && msValue <= UNSIGNED_LONG_MAX;
        }
        
        // Altre validazioni specifiche...
    };
}
```

### 3. Comunicazione Seriale

#### Requisito:
- Formato CSV specifico
- Gestione connessione
- Parsing dati

#### Implementazione:
```javascript
// main.js - Gestione comunicazione seriale
ipcMain.handle('send-serial-data', (event, { data }) => {
    return new Promise((resolve) => {
        if (!serialPort || !serialPort.isOpen) {
            resolve({ success: false, error: 'Port not connected' });
            return;
        }

        serialPort.write(data, err => {
            if (err) {
                resolve({ success: false, error: err.message });
            } else {
                resolve({ success: true });
            }
        });
    });
});

// App.jsx - Preparazione e invio dati
const handleSubmit = async () => {
    // Conversione tempi in millisecondi
    const convertedData = Object.entries(formData).reduce((acc, [key, value]) => {
        const isTimeField = ["fadeIn", "fadeOut", "onDuration", 
                           "offDuration", "offset", "startDelay"].includes(key);
        acc[key] = isTimeField ? (parseFloat(value) * 1000).toString() : value;
        return acc;
    }, {});

    // Formato CSV: CFG,<params...>\n
    const csvData = `CFG,${Object.values(convertedData).join(",")}\n`;
    
    const result = await ipcRenderer.invoke("send-serial-data", { data: csvData });
    // ... gestione risposta
};
```

### 4. Visualizzazione Dati (Plotter)

#### Requisito:
- Visualizzazione real-time
- 3 canali
- Risoluzione 10-bit

#### Implementazione:
```javascript
// SerialPlotter.jsx
export function SerialPlotter({ isConnected }) {
    const [data, setData] = useState([]);
    const [isPlotting, setIsPlotting] = useState(false);
    const MAX_POINTS = 100;
    const RESOLUTION = 1024; // 10-bit

    useEffect(() => {
        if (!isPlotting || !isConnected) return;

        const handleData = (plotData) => {
            setData(curr => {
                const newData = [...curr, {
                    time: new Date().getTime(),
                    channel1: plotData.channel1,
                    channel2: plotData.channel2,
                    channel3: plotData.channel3
                }];
                return newData.length > MAX_POINTS ? 
                       newData.slice(-MAX_POINTS) : newData;
            });
        };

        window.electron.ipcRenderer.on("plotter-data", handleData);
        return () => {
            window.electron.ipcRenderer.removeListener("plotter-data", handleData);
        };
    }, [isPlotting, isConnected]);

    return (
        <Card className="mt-8">
            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data}>
                    <YAxis domain={[0, RESOLUTION]} />
                    {/* ... configurazione grafico ... */}
                    <Line dataKey="channel1" stroke="#8884d8" />
                    <Line dataKey="channel2" stroke="#82ca9d" />
                    <Line dataKey="channel3" stroke="#ff7300" />
                </LineChart>
            </ResponsiveContainer>
        </Card>
    );
}
```

### 5. Persistenza Dati

#### Requisito:
- Salvataggio configurazioni
- Import/Export CSV
- Gestione formato

#### Implementazione:
```javascript
// SavedConfigs.jsx
export function SavedConfigs({ onLoadConfig }) {
    // Salvataggio
    const handleSave = async () => {
        const result = await ipcRenderer.invoke("save-config", {
            ...currentConfig,
            name: configName,
            timestamp: new Date().toISOString()
        });
    };

    // Export
    const handleExport = () => {
        const csvHeader = "CFG,Name,Program,FadeIn,...\n";
        const csvContent = configs.map(config => 
            `CFG,${config.name},${formatConfigToCsv(config)}`
        ).join('\n');
        
        // ... logica di download
    };

    // Import
    const handleImport = async (file) => {
        const content = await readFileAsText(file);
        const configs = parseConfigCsv(content);
        await ipcRenderer.invoke("import-configs", configs);
    };
}
```

## 🧪 Modalità Test

L'applicazione include una modalità simulazione per test senza hardware:

```javascript
// main.js
const USE_SIMULATOR = true; // false per uso reale

const simulatorHelpers = {
    startSimulation(mainWindow) {
        let time = 0;
        return setInterval(() => {
            // Genera onde sinusoidali sfasate
            const plotData = {
                channel1: Math.floor(512 + 512 * Math.sin(time / 1000)),
                channel2: Math.floor(512 + 512 * Math.sin(time / 1000 + Math.PI/3)),
                channel3: Math.floor(512 + 512 * Math.sin(time / 1000 + 2*Math.PI/3))
            };
            mainWindow.webContents.send('plotter-data', plotData);
            time += 100;
        }, 100);
    }
};
```

## 🔧 Architettura

- **Electron (main.js)**: Gestione seriale e sistema
- **React (App.jsx)**: UI e logica applicativa
- **Preload (preload.js)**: Bridge sicuro Electron-React
- **Components**: UI modulare e riutilizzabile

## 🛠️ Tecnologie Utilizzate

- **Framework**: Electron, React
- **UI**: shadcn/ui, Tailwind CSS
- **Grafici**: Recharts
- **Comunicazione**: SerialPort
- **Storage**: electron-store

## 📦 Scripts

```bash
# Sviluppo
npm run dev:electron    # Avvia in modalità sviluppo

# Produzione
npm run build          # Build applicazione
```

## 🤝 Contributing

Le pull request sono benvenute. Per modifiche importanti, apri prima una issue per discutere cosa vorresti cambiare.

## 📄 Licenza

[MIT](https://choosealicense.com/licenses/mit/)