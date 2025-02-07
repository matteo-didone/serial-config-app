import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { SavedConfigs } from "@/components/SavedConfigs";
import { SerialPlotter } from "@/components/SerialPlotter";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

const ipcRenderer = window.electron.ipcRenderer;

const UNSIGNED_LONG_MAX = 4294967295;

function App() {
  const [serialPorts, setSerialPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const showToast = useToast();

  // Form state
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
    forceStatus: "0", // 0: None, 1: Always ON, 2: Always OFF
    targetChannel: "0", // 0: All, 1-3: Specific channel
  });

  const [errors, setErrors] = useState({});

  const loadSerialPorts = async () => {
    try {
      const response = await ipcRenderer.invoke("get-serial-ports");
      const portsArray = Array.isArray(response.data) ? response.data : [];
      setSerialPorts(portsArray);
    } catch (error) {
      console.error("Error loading serial ports:", error);
      showToast("Error loading serial ports", "error");
      setSerialPorts([]);
    }
  };

  // Load serial ports on mount and every 15 seconds
  useEffect(() => {
    loadSerialPorts();
    const interval = setInterval(loadSerialPorts, 15000);
    return () => clearInterval(interval);
  }, []);

  // Effect to handle targetChannel changes
  useEffect(() => {
    if (formData.targetChannel !== "0") {
      setFormData((prev) => ({
        ...prev,
        channelsQty: "1",
      }));
    }
  }, [formData.targetChannel]);

  const handleConnect = async () => {
    if (!selectedPort) {
      showToast("Please select a port first", "error");
      return;
    }

    try {
      const result = await ipcRenderer.invoke("connect-serial", {
        path: selectedPort,
        baudRate: 9600,
      });

      if (result.success) {
        setIsConnected(true);
        showToast("Successfully connected to port", "success");
      } else {
        showToast(result.error || "Failed to connect", "error");
      }
    } catch (error) {
      console.error("Connection error:", error);
      showToast("Failed to connect: " + error.message, "error");
    }
  };

  const handleDisconnect = async () => {
    try {
      const result = await ipcRenderer.invoke("disconnect-serial");
      if (result.success) {
        setIsConnected(false);
        showToast("Successfully disconnected", "success");
      } else {
        showToast(result.error || "Failed to disconnect", "error");
      }
    } catch (error) {
      console.error("Disconnection error:", error);
      showToast("Failed to disconnect: " + error.message, "error");
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    validateField(field, value);
  };

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

  const handleSubmit = async () => {
    if (Object.keys(errors).length > 0) {
      showToast("Please fix all errors before sending", "error");
      return;
    }

    const csvData =
      `CFG,${formData.program},${formData.fadeIn},${formData.fadeOut},` +
      `${formData.onDuration},${formData.offDuration},${formData.offset},` +
      `${formData.startDelay},${formData.channelsQty},${formData.maxBrightness},` +
      `${formData.forceStatus},${formData.targetChannel}\n`;

    try {
      const result = await ipcRenderer.invoke("send-serial-data", {
        data: csvData,
      });
      if (result.success) {
        showToast("Configuration sent successfully", "success");
      } else {
        showToast(result.error || "Failed to send configuration", "error");
      }
    } catch (error) {
      console.error("Error sending data:", error);
      showToast("Error sending configuration: " + error.message, "error");
    }
  };

  const handleLoadConfig = (config) => {
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
    showToast("Configuration loaded successfully", "success");
    // On mobile, close sidebar after loading config
    if (window.innerWidth < 1024) {
      setShowSidebar(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Mobile Toggle Button */}
        <div className="fixed bottom-4 right-4 lg:hidden z-50">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSidebar(!showSidebar)}
            className="rounded-full shadow-lg"
          >
            {showSidebar ? <ChevronRight /> : <ChevronLeft />}
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row min-h-screen">
          {/* Main Content */}
          <div
            className={`flex-1 p-4 lg:p-8 ${
              showSidebar ? "hidden lg:block" : "block"
            }`}
          >
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Connection Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Connection Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Select
                      value={selectedPort}
                      onValueChange={setSelectedPort}
                    >
                      <SelectTrigger className="w-full sm:w-[240px]">
                        <SelectValue placeholder="Select port" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(serialPorts) &&
                        serialPorts.length > 0 ? (
                          serialPorts.map((port) => (
                            <SelectItem key={port.path} value={port.path}>
                              {port.path} ({port.manufacturer || "Unknown"})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-ports" disabled>
                            No ports available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {isConnected ? (
                      <Button
                        onClick={handleDisconnect}
                        className="w-full sm:w-auto"
                        variant="destructive"
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        onClick={handleConnect}
                        disabled={!selectedPort}
                        className="w-full sm:w-auto"
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Configuration Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Program Selection */}
                    <div className="space-y-2">
                      <Label>Program</Label>
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

                    {/* Force Status */}
                    <div className="space-y-2">
                      <Label>Force Status</Label>
                      <Select
                        value={formData.forceStatus}
                        onValueChange={(v) =>
                          handleInputChange("forceStatus", v)
                        }
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

                    {/* Target Channel */}
                    <div className="space-y-2">
                      <Label>Target Channel</Label>
                      <Select
                        value={formData.targetChannel}
                        onValueChange={(v) =>
                          handleInputChange("targetChannel", v)
                        }
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

                    {/* Channels Quantity */}
                    <div className="space-y-2">
                      <Label>Channels Quantity</Label>
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
                        <p className="text-sm text-destructive">
                          {errors.channelsQty}
                        </p>
                      )}
                    </div>

                    {/* Max Brightness */}
                    <div className="col-span-1 sm:col-span-2 space-y-2">
                      <Label>Max Brightness (%)</Label>
                      <Slider
                        value={[formData.maxBrightness]}
                        onValueChange={([value]) =>
                          handleInputChange("maxBrightness", value)
                        }
                        min={1}
                        max={100}
                        step={1}
                      />
                      <div className="text-right text-sm text-muted-foreground">
                        {formData.maxBrightness}%
                      </div>
                    </div>

                    {/* Timing Inputs */}
                    {[
                      "fadeIn",
                      "fadeOut",
                      "onDuration",
                      "offDuration",
                      "offset",
                      "startDelay",
                    ].map((field) => (
                      <div key={field} className="space-y-2">
                        <Label>
                          {field.charAt(0).toUpperCase() + field.slice(1)}
                        </Label>
                        <Input
                          type="number"
                          value={formData[field]}
                          onChange={(e) =>
                            handleInputChange(field, e.target.value)
                          }
                          disabled={formData.forceStatus !== "0"}
                          min={0}
                        />
                        {errors[field] && (
                          <p className="text-sm text-destructive">
                            {errors[field]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-4">
                    <Button
                      onClick={handleSubmit}
                      disabled={!isConnected || Object.keys(errors).length > 0}
                    >
                      Send Configuration
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Serial Plotter */}
              {isConnected && <SerialPlotter isConnected={isConnected} />}
            </div>
          </div>

          {/* Saved Configs Sidebar */}
          <div
            className={`
                fixed lg:static inset-0 bg-background
                w-full lg:w-[350px] h-full
                transition-transform duration-300 ease-in-out
                ${
                  showSidebar
                    ? "translate-x-0"
                    : "translate-x-full lg:translate-x-0"
                }
              `}
          >
            <SavedConfigs
              onLoadConfig={handleLoadConfig}
              currentConfig={formData}
            />
          </div>
        </div>
      </div>
      <Toaster />
    </>
  );
}

export default App;
