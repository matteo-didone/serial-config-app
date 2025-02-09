import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ConnectionManager = ({ onConnectionChange }) => {
  const [serialPorts, setSerialPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  const loadSerialPorts = async () => {
    try {
      const result = await ipcRenderer.invoke("get-serial-ports");
      console.log("Raw serial ports response:", result); // Debug log

      // Non assumiamo più una struttura con .data
      const portsArray = Array.isArray(result) ? result : [];
      console.log("Processed ports array:", portsArray); // Debug log

      setSerialPorts(portsArray.filter((port) => port && port.path));

      // Mantieni la selezione se la porta è ancora disponibile
      if (
        selectedPort &&
        !portsArray.some((port) => port.path === selectedPort)
      ) {
        setSelectedPort("");
        if (isConnected) {
          handleDisconnect();
        }
      }
    } catch (error) {
      console.error("Error loading serial ports:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load serial ports: " + error.message,
      });
      setSerialPorts([]);
    }
  };

  useEffect(() => {
    loadSerialPorts();
    const interval = setInterval(loadSerialPorts, 5000);
    return () => clearInterval(interval);
  }, []);

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
      const result = await window.electron.ipcRenderer.invoke(
        "connect-serial",
        {
          path: selectedPort,
          baudRate: 9600,
        }
      );

      if (result.success) {
        setIsConnected(true);
        onConnectionChange(true);
        toast({
          title: "Connected",
          description: "Successfully connected to port",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: result.error || "Failed to connect to port",
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
      const result = await window.electron.ipcRenderer.invoke(
        "disconnect-serial"
      );
      if (result.success) {
        setIsConnected(false);
        onConnectionChange(false);
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

  return (
    <Card className="bg-white shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Select value={selectedPort} onValueChange={setSelectedPort}>
              <SelectTrigger className="w-full">
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
          </div>

          <Button
            variant="default"
            className="min-w-[120px]"
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
  );
};

export default ConnectionManager;
