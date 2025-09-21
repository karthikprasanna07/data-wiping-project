import React, { useEffect, useState } from "react";
import WipeProgress from "./WipeProgress";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  FormControlLabel
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SettingsIcon from "@mui/icons-material/Settings";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import "./App.css";

function App() {
  const [devices, setDevices] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [wipingDevices, setWipingDevices] = useState(null);
  const [openWarning, setOpenWarning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

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

  const handleOpenWarning = () => {
    if (selectedDevices.length === 0) {
      alert("Select at least one device!");
      return;
    }
    setOpenWarning(true);
  };

  const handleProceedWipe = () => {
    setOpenWarning(false);
    setWipingDevices(selectedDevices);
    setConfirmed(false);
  };

  return (
    <Box className="app-container">
      {/* Top Bar */}
      <AppBar position="static" className="topbar">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            WipeX
          </Typography>
          <IconButton color="inherit"><HelpOutlineIcon /></IconButton>
          <IconButton color="inherit"><SettingsIcon /></IconButton>
          <IconButton color="inherit"><PowerSettingsNewIcon /></IconButton>
        </Toolbar>
      </AppBar>

      {/* Device list OR progress */}
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
        </Box>
      ) : (
        <WipeProgress devices={wipingDevices} />
      )}

      {/* Floating wipe button */}
      {!wipingDevices && (
        <Button
          variant="contained"
          color="error"
          onClick={handleOpenWarning}
          className="wipe-button"
        >
          Wipe
        </Button>
      )}

      {/* Warning Dialog */}
      <Dialog open={openWarning} onClose={() => setOpenWarning(false)} maxWidth="sm" fullWidth>
        <DialogTitle>⚠️ Confirm Data Wipe</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            Warning: This action is <b>permanent</b>. All data on the selected
            device(s) will be <b>unrecoverable</b>.
          </Alert>

          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
            }
            label="I understand that this action cannot be undone"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenWarning(false)}>Cancel</Button>
          <Button
            onClick={handleProceedWipe}
            color="error"
            variant="contained"
            disabled={!confirmed}
          >
            Proceed Wipe
          </Button>
        </DialogActions>
      </Dialog>

      {/* Footer */}
      <Box
        sx={{
          bgcolor: "#e0e0e0",
          p: 1,
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Typography variant="body2">© 2025 WipeX Prototype</Typography>
      </Box>
    </Box>
  );
}

export default App;
