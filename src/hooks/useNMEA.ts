import { useEffect, useRef } from "react";
import { useStore } from "../store";

export function useNMEA() {
  const settings = useStore((state) => state.settings);
  const setNmeaData = useStore((state) => state.setNmeaData);
  const wsRef = useRef<WebSocket | null>(null);
  const simIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Safely check if nmea settings exist (might be missing from older persisted state)
    const nmeaSettings = settings?.nmea;

    if (!nmeaSettings?.enabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (simIntervalRef.current) {
        window.clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      setNmeaData({
        depth: null,
        sog: null,
        stw: null,
        awa: null,
        aws: null,
        twa: null,
        tws: null,
      });
      return;
    }

    if (nmeaSettings.useSimulator) {
      // Run Simulator
      let depth = 12.5;
      let sog = 5.2;
      let awa = 45;
      let aws = 15;

      simIntervalRef.current = window.setInterval(() => {
        // Add some random noise to simulate real conditions
        depth += (Math.random() - 0.5) * 0.2;
        sog += (Math.random() - 0.5) * 0.1;
        awa += (Math.random() - 0.5) * 2;
        aws += (Math.random() - 0.5) * 0.5;

        // Keep values in realistic bounds
        if (depth < 2) depth = 2;
        if (sog < 0) sog = 0;
        if (awa > 180) awa -= 360;
        if (awa < -180) awa += 360;
        if (aws < 0) aws = 0;

        setNmeaData({
          depth: Number(depth.toFixed(1)),
          sog: Number(sog.toFixed(1)),
          stw: Number((sog * 0.95).toFixed(1)), // Speed through water slightly less
          awa: Number(awa.toFixed(0)),
          aws: Number(aws.toFixed(1)),
          twa: Number((awa + 10).toFixed(0)), // Fake true wind
          tws: Number((aws * 1.2).toFixed(1)),
        });
      }, 1000);
    } else {
      // Connect to real NMEA Gateway (e.g., Signal K or raw NMEA over WS)
      try {
        const ws = new WebSocket(
          `ws://${nmeaSettings.ip}:${nmeaSettings.port}`,
        );
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("Connected to NMEA Gateway");
        };

        ws.onmessage = (event) => {
          try {
            // Very simplified parsing assuming a JSON format like Signal K
            // In a real app, you'd need a robust NMEA 0183/2000 parser
            const data = JSON.parse(event.data);

            // Example mapping (would depend on actual gateway format)
            if (data.updates && data.updates[0].values) {
              const values = data.updates[0].values;
              const newData: any = {};

              values.forEach((v: any) => {
                if (v.path === "environment.depth.belowTransducer")
                  newData.depth = v.value;
                if (v.path === "navigation.speedOverGround")
                  newData.sog = v.value * 1.94384; // m/s to knots
                if (v.path === "navigation.speedThroughWater")
                  newData.stw = v.value * 1.94384;
                if (v.path === "environment.wind.angleApparent")
                  newData.awa = v.value * (180 / Math.PI); // rad to deg
                if (v.path === "environment.wind.speedApparent")
                  newData.aws = v.value * 1.94384;
              });

              if (Object.keys(newData).length > 0) {
                setNmeaData(newData);
              }
            }
          } catch (e) {
            // Ignore parse errors for raw NMEA strings in this simplified example
          }
        };

        ws.onerror = (error) => {
          console.error("NMEA WebSocket Error:", error);
        };

        ws.onclose = () => {
          console.log("NMEA WebSocket Closed");
        };
      } catch (error) {
        console.error("Failed to connect to NMEA Gateway:", error);
      }
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (simIntervalRef.current) {
        window.clearInterval(simIntervalRef.current);
      }
    };
  }, [settings?.nmea, setNmeaData]);
}
