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

export function SavedConfigs({ onLoadConfig, currentConfig }) {
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
      const response = await window.electron.ipcRenderer.invoke("load-configs");
      const configsArray = Array.isArray(response.data) ? response.data : [];
      setConfigs(configsArray);
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
      const result = await window.electron.ipcRenderer.invoke("save-config", {
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
      const result = await window.electron.ipcRenderer.invoke(
        "delete-config",
        configId
      );
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
      const result = await window.electron.ipcRenderer.invoke("export-configs");
      if (result.success) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "serial-configs.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Success",
          description: "Configurations exported successfully",
        });
      }
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
          const result = await window.electron.ipcRenderer.invoke(
            "import-configs",
            e.target.result
          );
          if (result.success) {
            await loadConfigs();
            toast({
              title: "Success",
              description: "Configurations imported successfully",
            });
          }
        } catch (error) {
          console.error("Error importing configurations:", error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to import configurations",
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
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header with title and action buttons */}
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">
            Saved Configurations
          </h2>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => setShowSaveDialog(true)}
            >
              <Save className="w-4 h-4" /> Save
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleExport}
            >
              <Download className="w-4 h-4" /> Export
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => document.getElementById("import-input").click()}
            >
              <Upload className="w-4 h-4" /> Import
            </Button>
          </div>
        </div>
      </div>

      {/* Configurations list */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {configs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-2">
                No saved configurations
              </div>
              <div className="text-gray-500 text-sm">
                Save your first configuration using the button above
              </div>
            </div>
          ) : (
            configs.map((config) => (
              <Card
                key={config.id}
                className="bg-white hover:shadow-md transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium mb-1">
                        {config.name}
                      </h3>
                      <div className="text-sm text-gray-500 space-y-1">
                        <p>
                          Program{" "}
                          {["A", "B", "C"][parseInt(config.program) - 1]}
                        </p>
                        <p>
                          {config.targetChannel === "0"
                            ? "All Channels"
                            : `Channel ${config.targetChannel}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => onLoadConfig(config)}
                      >
                        <FolderOpen className="w-4 h-4" /> Load
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setConfigToDelete(config);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" /> Delete
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
        accept=".json"
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
