import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, StopCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const MAX_POINTS = 100;
const RESOLUTION = 1024; // 10-bit resolution

export function SerialPlotter({ isConnected }) {
  const [data, setData] = useState([]);
  const [isPlotting, setIsPlotting] = useState(false);

  useEffect(() => {
    const handlePlotterData = (...args) => {
      const plotData = args[0]; // L'evento è il primo argomento
      console.log("Received data:", plotData);

      setData((currentData) => {
        const newData = [
          ...currentData,
          {
            time: new Date().getTime(),
            channel1: plotData.channel1,
            channel2: plotData.channel2,
            channel3: plotData.channel3,
          },
        ];
        return newData.length > MAX_POINTS
          ? newData.slice(-MAX_POINTS)
          : newData;
      });
    };

    if (isPlotting && isConnected) {
      console.log("Starting plotter monitoring");
      window.electron.ipcRenderer.on("plotter-data", handlePlotterData);
      return () => {
        console.log("Stopping plotter monitoring");
        window.electron.ipcRenderer.removeListener(
          "plotter-data",
          handlePlotterData
        );
      };
    } else {
      setData([]);
    }
  }, [isPlotting, isConnected]);

  const togglePlotting = () => {
    console.log("Toggling plotter:", !isPlotting);
    setIsPlotting(!isPlotting);
  };

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Serial Plotter</CardTitle>
        <Button
          onClick={togglePlotting}
          disabled={!isConnected}
          variant={isPlotting ? "destructive" : "default"}
          size="sm"
          className="w-24"
        >
          {isPlotting ? (
            <>
              <StopCircle className="mr-2 h-4 w-4" />
              Stop
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-4 w-4" />
              Start
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[400px] border rounded-lg p-4 bg-white">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                type="number"
                domain={["auto", "auto"]}
                tickFormatter={(time) => new Date(time).toLocaleTimeString()}
              />
              <YAxis domain={[0, RESOLUTION]} />
              <Tooltip
                labelFormatter={(time) => new Date(time).toLocaleTimeString()}
                formatter={(value) => [value, "Value"]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="channel1"
                stroke="#8884d8"
                dot={false}
                name="Channel 1"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="channel2"
                stroke="#82ca9d"
                dot={false}
                name="Channel 2"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="channel3"
                stroke="#ff7300"
                dot={false}
                name="Channel 3"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
