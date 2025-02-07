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
import { Save, Trash2, Download, Upload } from "lucide-react";

const ipcRenderer = window.electron.ipcRenderer;

export function SavedConfigs({ onLoadConfig, currentConfig }) {
  const [configs, setConfigs] = useState([]);
  const [newConfigName, setNewConfigName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [configToDelete, setConfigToDelete] = useState(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await ipcRenderer.invoke("load-configs");
      const configsArray = Array.isArray(response.data) ? response.data : [];
      setConfigs(configsArray);
    } catch (error) {
      console.error("Error loading configurations:", error);
      setConfigs([]); // Set empty array on error
    }
  };

  const handleSave = async () => {
    if (!newConfigName.trim()) return;

    try {
      const result = await ipcRenderer.invoke("save-config", {
        ...currentConfig,
        name: newConfigName,
      });
      if (result.success) {
        await loadConfigs();
        setShowSaveDialog(false);
        setNewConfigName("");
      }
    } catch (error) {
      console.error("Error saving configuration:", error);
    }
  };

  const handleDelete = async (configId) => {
    try {
      const result = await ipcRenderer.invoke("delete-config", configId);
      if (result.success) {
        await loadConfigs();
        setShowDeleteDialog(false);
        setConfigToDelete(null);
      }
    } catch (error) {
      console.error("Error deleting configuration:", error);
    }
  };

  const handleExport = async () => {
    try {
      const result = await ipcRenderer.invoke("export-configs");
      if (result.success) {
        const blob = new Blob([result.data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "serial-configs.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error exporting configurations:", error);
    }
  };

  const handleImport = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = await ipcRenderer.invoke(
            "import-configs",
            e.target.result
          );
          if (result.success) {
            await loadConfigs();
          }
        } catch (error) {
          console.error("Error importing configurations:", error);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error("Error reading file:", error);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Saved Configurations</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveDialog(true)}
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("import-input").click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <input
            id="import-input"
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-4">
          {Array.isArray(configs) &&
            configs.map((config) => (
              <Card key={config.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{config.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Program {["A", "B", "C"][parseInt(config.program) - 1]}{" "}
                        |
                        {config.targetChannel === "0"
                          ? " All Channels"
                          : ` Channel ${config.targetChannel}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onLoadConfig(config)}
                      >
                        Load
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
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
            ))}
        </div>
      </ScrollArea>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Configuration name"
              value={newConfigName}
              onChange={(e) => setNewConfigName(e.target.value)}
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
          <p>Are you sure you want to delete this configuration?</p>
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
