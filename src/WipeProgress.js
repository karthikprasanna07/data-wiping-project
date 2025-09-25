import React, { useState, useEffect } from "react";
import { CircularProgress, Typography, Box, Button } from "@mui/material";
import "./App.css";

function WipeProgress({ devices }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [completedDevices, setCompletedDevices] = useState([]);
  const [eta, setEta] = useState(null); // ETA state

  // Font family applied here to the root box
  const fontStyle = { fontFamily: '"Poppins", sans-serif' };

  useEffect(() => {
    if (currentIndex >= devices.length) return;

    const device = devices[currentIndex];
    setProgress(0);
    setEta(null); // reset ETA for new device

    const url = `http://127.0.0.1:5000/wipe_stream?mountpoint=${encodeURIComponent(device)}&passes=3`;
    const es = new EventSource(url, { withCredentials: true });

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.progress !== undefined) setProgress(data.progress);
      if (data.eta !== undefined) setEta(data.eta);

      if (data.done) {
        setCompletedDevices(prev => [
          ...prev,
          {
            device,
            certificate: data.certificate || null,
            certificate_error: data.certificate_error || null
          }
        ]);
        setCurrentIndex(prev => prev + 1);
        es.close();
      }
    };

    es.onerror = (err) => {
      console.error("SSE error:", err);
      es.close();
    };

    return () => es.close();
  }, [currentIndex, devices]);

  if (currentIndex >= devices.length) {
    return (
      <Box className="wipe-progress-container" sx={fontStyle}>
        <Typography variant="h5" sx={fontStyle}>All selected devices wiped!</Typography>
        {completedDevices.map((d, idx) => (
          <Box key={idx} sx={{ mt: 1 }}>
            <Button
              variant="contained"
              color="success"
              href={
                d.certificate
                  ? `http://127.0.0.1:5000/certificate/${d.certificate}?format=pdf`
                  : "#"
              }
              target="_blank"
              rel="noopener noreferrer"
              disabled={!d.certificate}
              sx={{ mr: 1, ...fontStyle }}
            >
              {d.certificate
                ? `Download PDF for ${d.device}`
                : `PDF Failed for ${d.device}`}
            </Button>

            <Button
              variant="contained"
              color="primary"
              href={
                d.certificate
                  ? `http://127.0.0.1:5000/certificate/${d.certificate}?format=json`
                  : "#"
              }
              target="_blank"
              rel="noopener noreferrer"
              disabled={!d.certificate}
              sx={fontStyle}
            >
              {d.certificate
                ? `Download JSON for ${d.device}`
                : `JSON Failed for ${d.device}`}
            </Button>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box className="wipe-progress-container" sx={fontStyle}>
      <Typography variant="h6" sx={fontStyle}>Wiping device: {devices[currentIndex]}</Typography>
      <CircularProgress variant="determinate" value={progress} size={100} />
      <Typography variant="h6" mt={2} sx={fontStyle}>{progress}%</Typography>
      <Typography variant="h6" mt={1} sx={fontStyle}>
        {eta !== null ? `ETA: ${Math.floor(eta / 60)}m ${Math.ceil(eta % 60)}s` : ""}
      </Typography>
    </Box>
  );
}

export default WipeProgress;
