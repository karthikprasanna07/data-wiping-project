import React, { useEffect, useState } from "react";
import WipeProgress from "./WipeProgress";
import { Box, Button, Checkbox, Typography } from "@mui/material";
import "./App.css";

function App() {
  const [devices, setDevices] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [wipingDevices, setWipingDevices] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/devices")
      .then(res => res.json())
      .then(data => setDevices(data))
      .catch(err => console.error(err));
  }, []);

  const handleCheckbox = (mountpoint) => {
    setSelectedDevices(prev => 
      prev.includes(mountpoint)
        ? prev.filter(d => d !== mountpoint)
        : [...prev, mountpoint]
    );
  };

  const handleWipe = () => {
    if (selectedDevices.length === 0) {
      alert("Select at least one device!");
      return;
    }
    setWipingDevices(selectedDevices);
  };

  return (
    <Box className="app-container">
      <Typography variant="h4">USB Data Wiper</Typography>

      {!wipingDevices ? (
        <Box mt={4} className="device-list">
          <Typography variant="h6">Select device(s) to wipe:</Typography>

          {devices.length === 0 && <Typography>No devices detected</Typography>}

          {devices.map((d, idx) => (
            <Box key={idx} className="device-item">
              <Typography>
                {d.device} → Mounted at {d.mountpoint} ({d.fstype})
              </Typography>
              <Checkbox
                checked={selectedDevices.includes(d.mountpoint)}
                onChange={() => handleCheckbox(d.mountpoint)}
              />
            </Box>
          ))}

          <Button
            variant="contained"
            color="error"
            onClick={handleWipe}
            className="wipe-button"
          >
            Wipe
          </Button>
        </Box>
      ) : (
        <WipeProgress devices={wipingDevices} />
      )}

      <Box className="app-footer">© 2025 WipeX Prototype</Box>
    </Box>
  );
}

export default App;
