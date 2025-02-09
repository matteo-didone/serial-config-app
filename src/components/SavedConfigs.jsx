import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Trash2, Download, Upload, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ipcRenderer = window.electron.ipcRenderer;

export function SavedConfigs({ onLoadConfig, currentConfig, isSidebarOpen }) {
  const [configs, setConfigs] = useState([]);
  const [newConfigName, setNewConfigName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [configToDelete, setConfigToDelete] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadConfigs();
  }, []);

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

  const handleSave = async () => {
    if (!newConfigName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a configuration name",
      });
      return;
    }

    try {
      const result = await ipcRenderer.invoke("save-config", {
        ...currentConfig,
        name: newConfigName,
      });

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

  const handleDelete = async (configId) => {
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

  const handleExport = async () => {
    try {
      // Prepare CSV data
      const csvHeader =
        "CFG,Program,FadeIn,FadeOut,OnDuration,OffDuration,Offset,StartDelay,ChannelsQty,MaxBrightness,ForceStatus,TargetChannel\n";
      const csvRows = configs
        .map(
          (config) =>
            `CFG,${config.program},${config.fadeIn},${config.fadeOut},${config.onDuration},` +
            `${config.offDuration},${config.offset},${config.startDelay},${config.channelsQty},` +
            `${config.maxBrightness},${config.forceStatus},${config.targetChannel}`
        )
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

  const handleImport = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvContent = e.target.result;
          const result = await ipcRenderer.invoke("import-configs", csvContent);

          if (result.success) {
            await loadConfigs();
            toast({
              title: "Success",
              description: `Imported ${result.count} configurations successfully`,
            });
          } else {
            toast({
              variant: "destructive",
              title: "Error",
              description: result.error || "Failed to import configurations",
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
    <div
      className={`h-full flex flex-col bg-white border-r border-gray-200 
      ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} 
      transition-transform duration-200 ease-in-out`}
    >
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">
            Saved Configurations
          </h2>
        </div>
      </div>

      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col gap-2">
          <Button
            className="w-full flex items-center justify-center gap-2"
            onClick={() => setShowSaveDialog(true)}
          >
            <Save className="w-4 h-4" />
            Save Current
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
              <Card
                key={config.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{config.name}</h3>
                      <p className="text-sm text-gray-500">
                        Program {["A", "B", "C"][parseInt(config.program) - 1]}{" "}
                        |
                        {config.targetChannel === "0"
                          ? " All Channels"
                          : ` Channel ${config.targetChannel}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-700"
                        onClick={() => onLoadConfig(config)}
                      >
                        <FolderOpen className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          setConfigToDelete(config);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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
            <Button onClick={handleSave}>Save</Button>
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
              onClick={() => handleDelete(configToDelete?.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
