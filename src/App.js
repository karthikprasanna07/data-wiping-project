import React, { useEffect, useState } from "react";
import WipeProgress from "./WipeProgress";
import { Box, Button, Checkbox, FormControlLabel, Typography } from "@mui/material";

function App() {
  const [devices, setDevices] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [wipingDevices, setWipingDevices] = useState(null);

  // Fetch devices from backend on mount
  useEffect(() => {
    fetch("http://127.0.0.1:5000/devices")
      .then(res => res.json())
      .then(data => setDevices(data))
      .catch(err => console.error("Error fetching devices:", err));
  }, []);

  // Toggle device selection
  const handleCheckbox = (mountpoint) => {
    setSelectedDevices(prev => 
      prev.includes(mountpoint)
        ? prev.filter(d => d !== mountpoint)
        : [...prev, mountpoint]
    );
  };

  // Start wiping selected devices
  const handleWipe = () => {
    if (selectedDevices.length === 0) {
      alert("Select at least one device!");
      return;
    }
    setWipingDevices(selectedDevices);
  };

  return (
    <Box textAlign="center" mt={4}>
      <Typography variant="h4">USB Data Wiper</Typography>

      {!wipingDevices ? (
        <Box mt={4}>
          <Typography variant="h6">Select device(s) to wipe:</Typography>

          {devices.length === 0 && <Typography>No devices detected</Typography>}

          {devices.map((d, idx) => (
            <FormControlLabel
              key={idx}
              control={
                <Checkbox
                  checked={selectedDevices.includes(d.mountpoint)}
                  onChange={() => handleCheckbox(d.mountpoint)}
                />
              }
              label={`${d.device} → Mounted at ${d.mountpoint} (${d.fstype})`}
            />
          ))}

          <Box mt={2}>
            <Button
              variant="contained"
              color="error"
              onClick={handleWipe}
            >
              Wipe Selected Device(s)
            </Button>
          </Box>
        </Box>
      ) : (
        <WipeProgress devices={wipingDevices} />
      )}
    </Box>
  );
}

export default App;
