import React, { useState, useEffect } from "react";
import { CircularProgress, Typography, Box, Button } from "@mui/material";

function WipeProgress({ devices }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [completedDevices, setCompletedDevices] = useState([]);

  useEffect(() => {
    if (currentIndex >= devices.length) return;

    const device = devices[currentIndex];
    setProgress(0);

    // SSE URL with query params
    const url = `http://127.0.0.1:5000/wipe_stream?mountpoint=${encodeURIComponent(device)}&passes=3`;
    const es = new EventSource(url, { withCredentials: true });

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.progress !== undefined) setProgress(data.progress);

      if (data.done) {
        setCompletedDevices(prev => [
          ...prev,
          { device, certificate: data.certificate }
        ]);
        setCurrentIndex(prev => prev + 1);
        es.close();
      }
    };

    es.onerror = (err) => {
      console.error("SSE error:", err);
      es.close();
    };

    // Cleanup on unmount
    return () => {
      es.close();
    };
  }, [currentIndex, devices]);

  if (currentIndex >= devices.length) {
    return (
      <Box textAlign="center" mt={4}>
        <Typography variant="h5">All selected devices wiped!</Typography>
        {completedDevices.map((d, idx) => (
          <Button
            key={idx}
            variant="contained"
            color="success"
            href={`http://127.0.0.1:5000/certificate/${d.certificate}`}
            sx={{ mt: 2 }}
          >
            Download Certificate for {d.device}
          </Button>
        ))}
      </Box>
    );
  }

  return (
    <Box textAlign="center" mt={4}>
      <Typography variant="h6">Wiping device: {devices[currentIndex]}</Typography>
      <CircularProgress variant="determinate" value={progress} size={100} />
      <Typography variant="h6" mt={2}>{progress}%</Typography>
    </Box>
  );
}

export default WipeProgress;
