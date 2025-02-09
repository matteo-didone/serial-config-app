import React, { useEffect, useRef, useState } from "react";
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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, StopCircle } from "lucide-react";

const ipcRenderer = window.electron.ipcRenderer;

const MAX_POINTS = 100;
const RESOLUTION = 1024; // 10-bit resolution

export function SerialPlotter({ isConnected }) {
  const [data, setData] = useState([]);
  const [isPlotting, setIsPlotting] = useState(false);
  const dataRef = useRef([]);

  useEffect(() => {
    if (isPlotting && isConnected) {
      const handlePlotterData = (event, plotData) => {
        const newPoint = {
          time: new Date().getTime(),
          channel1: plotData.channel1,
          channel2: plotData.channel2,
          channel3: plotData.channel3,
        };

        dataRef.current = [...dataRef.current, newPoint];
        if (dataRef.current.length > MAX_POINTS) {
          dataRef.current.shift();
        }

        setData([...dataRef.current]);
      };

      ipcRenderer.on("plotter-data", handlePlotterData);

      return () => {
        ipcRenderer.removeListener("plotter-data", handlePlotterData);
      };
    } else if (!isPlotting) {
      dataRef.current = [];
      setData([]);
    }
  }, [isPlotting, isConnected]);

  const togglePlotting = () => {
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
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                domain={["auto", "auto"]}
                type="number"
                tickFormatter={(time) => new Date(time).toLocaleTimeString()}
              />
              <YAxis domain={[0, RESOLUTION]} />
              <Tooltip
                labelFormatter={(time) => new Date(time).toLocaleTimeString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="channel1"
                stroke="#8884d8"
                dot={false}
                name="Channel 1"
              />
              <Line
                type="monotone"
                dataKey="channel2"
                stroke="#82ca9d"
                dot={false}
                name="Channel 2"
              />
              <Line
                type="monotone"
                dataKey="channel3"
                stroke="#ff7300"
                dot={false}
                name="Channel 3"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
