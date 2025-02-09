import React, { useState, useEffect } from "react";
import { Save, Trash2, Download, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SerialPlotter } from "@/components/SerialPlotter";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

const ipcRenderer = window.electron.ipcRenderer;
const UNSIGNED_LONG_MAX = 4294967295;

function App() {
  // Stati della connessione seriale
  const [serialPorts, setSerialPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  // Stati per le configurazioni salvate
  const [configs, setConfigs] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [configToDelete, setConfigToDelete] = useState(null);
  const [newConfigName, setNewConfigName] = useState("");

  // Stati del form
  const [formData, setFormData] = useState({
    program: "1",
    channelsQty: "1",
    fadeIn: "0",
    fadeOut: "0",
    onDuration: "0",
    offDuration: "0",
    offset: "0",
    startDelay: "0",
    maxBrightness: 100,
    forceStatus: "0",
    targetChannel: "0",
  });

  const [errors, setErrors] = useState({});

  // Effects
  useEffect(() => {
    loadSerialPorts();
    const interval = setInterval(loadSerialPorts, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    if (formData.targetChannel !== "0") {
      setFormData((prev) => ({ ...prev, channelsQty: "1" }));
    }
  }, [formData.targetChannel]);

  // Funzioni di caricamento
  const loadSerialPorts = async () => {
    try {
      const result = await ipcRenderer.invoke("get-serial-ports");
      const validPorts = Array.isArray(result)
        ? result
        : result && Array.isArray(result.data)
        ? result.data
        : [];

      setSerialPorts(validPorts.filter((port) => port && port.path));

      // Mantieni la selezione solo se la porta è ancora disponibile
      if (
        selectedPort &&
        !validPorts.some((port) => port.path === selectedPort)
      ) {
        setSelectedPort("");
        if (isConnected) handleDisconnect();
      }
    } catch (error) {
      console.error("Error loading serial ports:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load serial ports",
      });
      setSerialPorts([]);
    }
  };

  const loadConfigs = async () => {
    try {
      const response = await ipcRenderer.invoke("load-configs");
      setConfigs(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error loading configurations:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load configurations",
      });
    }
  };

  // Gestione connessione seriale
  const handleConnect = async () => {
    if (!selectedPort) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a port first",
      });
      return;
    }

    setIsConnecting(true);
    try {
      const result = await ipcRenderer.invoke("connect-serial", {
        path: selectedPort,
        baudRate: 9600,
      });

      if (result.success) {
        setIsConnected(true);
        toast({
          title: "Connected",
          description: "Successfully connected to port",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Failed to connect",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Connection error: " + error.message,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const result = await ipcRenderer.invoke("disconnect-serial");
      if (result.success) {
        setIsConnected(false);
        toast({
          title: "Disconnected",
          description: "Successfully disconnected from port",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Failed to disconnect",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Disconnection error: " + error.message,
      });
    }
  };

  // Gestione form e validazione
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    validateField(field, value);
  };

  // Modifica della funzione validateField per gestire i secondi
  const validateField = (field, value) => {
    const newErrors = { ...errors };
    const numValue = Number(value);

    switch (field) {
      case "channelsQty":
        if (numValue < 1 || numValue > 3) {
          newErrors[field] = "Must be between 1 and 3";
        } else {
          delete newErrors[field];
        }
        break;
      case "maxBrightness":
        if (numValue < 1 || numValue > 100) {
          newErrors[field] = "Must be between 1 and 100";
        } else {
          delete newErrors[field];
        }
        break;
      // Gestione campi temporali (in secondi)
      case "fadeIn":
      case "fadeOut":
      case "onDuration":
      case "offDuration":
      case "offset":
      case "startDelay":
        if (value === "" || isNaN(numValue)) {
          newErrors[field] = "Must be a valid number";
        } else if (numValue < 0) {
          newErrors[field] = "Must be positive";
        } else {
          // Converti i secondi in millisecondi per il controllo
          const msValue = numValue * 1000;
          if (msValue > UNSIGNED_LONG_MAX) {
            newErrors[field] = `Must be less than ${Math.floor(
              UNSIGNED_LONG_MAX / 1000
            )} seconds`;
          } else {
            delete newErrors[field];
          }
        }
        break;
      default:
        if (
          field !== "program" &&
          field !== "forceStatus" &&
          field !== "targetChannel"
        ) {
          if (value === "" || isNaN(numValue)) {
            newErrors[field] = "Must be a valid number";
          } else if (numValue < 0) {
            newErrors[field] = "Must be positive";
          } else if (numValue > UNSIGNED_LONG_MAX) {
            newErrors[field] = `Must be less than ${UNSIGNED_LONG_MAX}`;
          } else {
            delete newErrors[field];
          }
        }
    }

    setErrors(newErrors);
  };

  // Modifica della funzione handleSubmit per convertire i tempi in millisecondi
  const handleSubmit = async () => {
    if (Object.keys(errors).length > 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fix all errors before sending",
      });
      return;
    }

    // Converti i tempi da secondi a millisecondi
    const timeFields = [
      "fadeIn",
      "fadeOut",
      "onDuration",
      "offDuration",
      "offset",
      "startDelay",
    ];
    const convertedData = { ...formData };

    timeFields.forEach((field) => {
      convertedData[field] = (parseFloat(formData[field]) * 1000).toString();
    });

    const csvData =
      `CFG,${convertedData.program},${convertedData.fadeIn},${convertedData.fadeOut},` +
      `${convertedData.onDuration},${convertedData.offDuration},${convertedData.offset},` +
      `${convertedData.startDelay},${convertedData.channelsQty},${convertedData.maxBrightness},` +
      `${convertedData.forceStatus},${convertedData.targetChannel}\n`;

    console.log("Sending data:", csvData); // Aggiungiamo questo log

    try {
      const result = await ipcRenderer.invoke("send-serial-data", {
        data: csvData,
      });
      if (result.success) {
        toast({
          title: "Success",
          description: "Configuration sent successfully",
        });
        console.log("Configuration sent successfully"); // E questo
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Failed to send configuration",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send configuration: " + error.message,
      });
    }
  };

  // Gestione configurazioni salvate
  const handleSaveConfig = async () => {
    if (!newConfigName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a configuration name",
      });
      return;
    }

    try {
      // Crea una copia dei dati del form
      const configToSave = { ...formData };

      // I valori sono già in secondi nell'UI, quindi non serve convertire
      // Aggiungiamo solo il nome
      configToSave.name = newConfigName;

      const result = await ipcRenderer.invoke("save-config", configToSave);

      if (result.success) {
        await loadConfigs();
        setShowSaveDialog(false);
        setNewConfigName("");
        toast({
          title: "Success",
          description: "Configuration saved successfully",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save configuration",
      });
    }
  };

  const handleDeleteConfig = async (configId) => {
    try {
      const result = await ipcRenderer.invoke("delete-config", configId);
      if (result.success) {
        await loadConfigs();
        setShowDeleteDialog(false);
        setConfigToDelete(null);
        toast({
          title: "Success",
          description: "Configuration deleted successfully",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete configuration",
      });
    }
  };

  const handleLoadConfig = (config) => {
    // I valori sono già in secondi nel database, quindi li carichiamo direttamente
    setFormData({
      program: config.program,
      channelsQty: config.channelsQty,
      fadeIn: config.fadeIn,
      fadeOut: config.fadeOut,
      onDuration: config.onDuration,
      offDuration: config.offDuration,
      offset: config.offset,
      startDelay: config.startDelay,
      maxBrightness: config.maxBrightness || 100,
      forceStatus: config.forceStatus || "0",
      targetChannel: config.targetChannel || "0",
    });

    toast({
      title: "Success",
      description: "Configuration loaded successfully",
    });
  };

  // Export function
  const handleExport = async () => {
    try {
      // Add Name in the header and data
      const csvHeader =
        "CFG,Name,Program,FadeIn,FadeOut,OnDuration,OffDuration,Offset,StartDelay,ChannelsQty,MaxBrightness,ForceStatus,TargetChannel\n";

      const csvRows = configs
        .map((config) => {
          return (
            `CFG,${config.name},${config.program},${config.fadeIn},${config.fadeOut},` +
            `${config.onDuration},${config.offDuration},${config.offset},` +
            `${config.startDelay},${config.channelsQty},${config.maxBrightness},` +
            `${config.forceStatus},${config.targetChannel}`
          );
        })
        .join("\n");

      const csvContent = csvHeader + csvRows;
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "serial-configs.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Configurations exported successfully",
      });
    } catch (error) {
      console.error("Error exporting configurations:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export configurations",
      });
    }
  };

  // Import function
  const handleImport = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvContent = e.target.result;
          const lines = csvContent.split("\n").filter((line) => line.trim());

          // Check if first line is header and skip it
          const startIndex = lines[0].toLowerCase().startsWith("cfg,name")
            ? 1
            : 0;

          const configs = [];
          for (let i = startIndex; i < lines.length; i++) {
            const parts = lines[i].split(",");
            if (parts.length >= 13 && parts[0] === "CFG") {
              const config = {
                name: parts[1],
                program: parts[2],
                fadeIn: parts[3],
                fadeOut: parts[4],
                onDuration: parts[5],
                offDuration: parts[6],
                offset: parts[7],
                startDelay: parts[8],
                channelsQty: parts[9],
                maxBrightness: parts[10],
                forceStatus: parts[11],
                targetChannel: parts[12].trim(),
                id: Date.now().toString() + i, // Add unique ID
              };
              configs.push(config);
            }
          }

          if (configs.length > 0) {
            const result = await ipcRenderer.invoke(
              "import-configs",
              csvContent
            );
            if (result.success) {
              await loadConfigs();
              toast({
                title: "Success",
                description: `Imported ${configs.length} configurations successfully`,
              });
            }
          } else {
            toast({
              variant: "destructive",
              title: "Error",
              description: "No valid configurations found in file",
            });
          }
        } catch (error) {
          console.error("Error importing configurations:", error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to import configurations: " + error.message,
          });
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    } catch (error) {
      console.error("Error reading file:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to read import file",
      });
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar con configurazioni salvate */}
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Saved Configurations
          </h2>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col gap-2">
            <Button
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => setShowSaveDialog(true)}
            >
              <Save className="w-4 h-4" />
              Save Current Config
            </Button>

            <div className="flex gap-2">
              <Button
                className="flex-1 flex items-center justify-center gap-2"
                variant="outline"
                onClick={handleExport}
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button
                className="flex-1 flex items-center justify-center gap-2"
                variant="outline"
                onClick={() => document.getElementById("import-input").click()}
              >
                <Upload className="w-4 h-4" />
                Import
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {configs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No saved configurations
              </div>
            ) : (
              configs.map((config) => (
                <Card key={config.id} className="group">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{config.name}</h3>
                          <p className="text-sm text-gray-500">
                            Program{" "}
                            {["A", "B", "C"][parseInt(config.program) - 1]} |
                            {config.targetChannel === "0"
                              ? " All Channels"
                              : ` Channel ${config.targetChannel}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setConfigToDelete(config);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleLoadConfig(config)}
                      >
                        Load Configuration
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>

        <input
          id="import-input"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleImport}
        />
      </aside>

      {/* Contenuto principale */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto py-8 px-6">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-semibold">Serial Configuration</h1>
          </div>

          {/* Stato connessione */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-lg font-medium mb-4">Connection Status</h2>
              <div className="flex gap-4 items-center">
                <Select value={selectedPort} onValueChange={setSelectedPort}>
                  <SelectTrigger className="w-[400px]">
                    <SelectValue placeholder="Select port" />
                  </SelectTrigger>
                  <SelectContent>
                    {serialPorts.length > 0 ? (
                      serialPorts.map((port) => (
                        <SelectItem key={port.path} value={port.path}>
                          {port.path} ({port.manufacturer || "Unknown"})
                          {port.vendorId
                            ? ` [${port.vendorId}:${port.productId}]`
                            : ""}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-ports" disabled>
                        No ports available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>

                <Button
                  className="ml-auto min-w-[140px]"
                  onClick={isConnected ? handleDisconnect : handleConnect}
                  disabled={!selectedPort || isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting
                    </>
                  ) : isConnected ? (
                    "Disconnect"
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Configuration Parameters */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-medium mb-6">
                Configuration Parameters
              </h2>

              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                {/* Program and Channels */}
                <div className="space-y-2">
                  <Label>Program (A, B, C)</Label>
                  <Select
                    value={formData.program}
                    onValueChange={(v) => handleInputChange("program", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select program" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Program A</SelectItem>
                      <SelectItem value="2">Program B</SelectItem>
                      <SelectItem value="3">Program C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Channels Quantity (1-3)</Label>
                  <Input
                    type="number"
                    value={formData.channelsQty}
                    onChange={(e) =>
                      handleInputChange("channelsQty", e.target.value)
                    }
                    disabled={formData.targetChannel !== "0"}
                    min={1}
                    max={3}
                  />
                  {errors.channelsQty && (
                    <p className="text-sm text-red-500">{errors.channelsQty}</p>
                  )}
                </div>

                {/* Force Status and Target Channel */}
                <div className="space-y-2">
                  <Label>Force Status</Label>
                  <Select
                    value={formData.forceStatus}
                    onValueChange={(v) => handleInputChange("forceStatus", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None</SelectItem>
                      <SelectItem value="1">Always ON</SelectItem>
                      <SelectItem value="2">Always OFF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Channel</Label>
                  <Select
                    value={formData.targetChannel}
                    onValueChange={(v) => handleInputChange("targetChannel", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All Channels</SelectItem>
                      <SelectItem value="1">Channel 1</SelectItem>
                      <SelectItem value="2">Channel 2</SelectItem>
                      <SelectItem value="3">Channel 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {[
                  ["fadeIn", "fadeOut"],
                  ["onDuration", "offDuration"],
                  ["offset", "startDelay"],
                ].map(([field1, field2]) => (
                  <React.Fragment key={field1 + field2}>
                    <div className="space-y-2">
                      <Label>
                        {field1.replace(/([A-Z])/g, " $1").trim()} Time (s)
                      </Label>
                      <Input
                        type="number"
                        value={formData[field1]}
                        onChange={(e) =>
                          handleInputChange(field1, e.target.value)
                        }
                        disabled={formData.forceStatus !== "0"}
                        min={0}
                        step="0.1"
                      />
                      {errors[field1] && (
                        <p className="text-sm text-red-500">{errors[field1]}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>
                        {field2.replace(/([A-Z])/g, " $1").trim()} Time (s)
                      </Label>
                      <Input
                        type="number"
                        value={formData[field2]}
                        onChange={(e) =>
                          handleInputChange(field2, e.target.value)
                        }
                        disabled={formData.forceStatus !== "0"}
                        min={0}
                        step="0.1"
                      />
                      {errors[field2] && (
                        <p className="text-sm text-red-500">{errors[field2]}</p>
                      )}
                    </div>
                  </React.Fragment>
                ))}

                {/* Max Brightness slider */}
                <div className="col-span-2 space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Max Brightness (%)</Label>
                    <span className="text-sm text-gray-500">
                      {formData.maxBrightness}%
                    </span>
                  </div>
                  <Slider
                    value={[formData.maxBrightness]}
                    onValueChange={([value]) =>
                      handleInputChange("maxBrightness", value)
                    }
                    min={1}
                    max={100}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={!isConnected || Object.keys(errors).length > 0}
                  className="px-8"
                >
                  Send Configuration
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Serial Plotter */}
          {isConnected && <SerialPlotter isConnected={isConnected} />}
        </div>
      </main>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Configuration</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Configuration name"
              value={newConfigName}
              onChange={(e) => setNewConfigName(e.target.value)}
              className="w-full"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Configuration</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete this configuration?
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteConfig(configToDelete?.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}

export default App;
