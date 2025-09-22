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
  FormControlLabel,
  TextField
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SettingsIcon from "@mui/icons-material/Settings";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import "./App.css";

function App() {
  const [aadhar, setAadhar] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleSendOtp = () => {
    if (aadhar.length !== 12) {
      alert("Enter a valid 12-digit Aadhaar number");
      return;
    }
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(newOtp);
    setOtpSent(true);
    alert(`OTP sent to registered mobile: ${newOtp}`); // For prototype
  };

  const handleVerifyOtp = () => {
    if (otp === generatedOtp) {
      setVerified(true);
      alert("OTP Verified Successfully!");
    } else {
      alert("Invalid OTP. Try again.");
    }
  };

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
          <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1 }}>
            <img
              src="/logobg.png" // adjust path based on where you store it
              alt="logo"
              style={{ height: "50px", marginRight: "8px" }}
            />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              WipeX
            </Typography>
          </Box>
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
            <Box
              key={idx}
              className="device-item"
              onClick={() => handleCheckbox(d.mountpoint)} // row click toggles
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            >
              <Typography>
                {d.device} → Mounted at {d.mountpoint} ({d.fstype})
              </Typography>
              <Checkbox
                checked={selectedDevices.includes(d.mountpoint)}
                onChange={(e) => handleCheckbox(d.mountpoint)}
                onClick={(e) => e.stopPropagation()} // prevents double toggle when clicking checkbox
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
      {/* Warning Dialog */}
      <Dialog open={openWarning} onClose={() => setOpenWarning(false)} maxWidth="sm" fullWidth>
        <DialogTitle>⚠️ Confirm Data Wipe</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            Warning: This action is <b>permanent</b>. All data on the selected
            device(s) will be <b>unrecoverable</b>.
          </Alert>
          {/* List of selected devices */}
          {/* Styled list of selected devices */}
          {selectedDevices.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                Devices selected for wiping:
              </Typography>
              <Box
                sx={{
                  maxHeight: 150,      // limits height if too many devices
                  overflowY: 'auto',   // adds vertical scroll if needed
                  border: '1px solid #f44336', // red border to match warning
                  borderRadius: 1,
                  p: 1,
                  backgroundColor: '#ffebee', // light red background
                }}
              >
                {selectedDevices.map((mountpoint, idx) => {
                  const device = devices.find(d => d.mountpoint === mountpoint);
                  return (
                    <Typography
                      key={idx}
                      variant="body2"
                      sx={{ mb: 0.5, fontFamily: 'monospace' }}
                    >
                      {device ? `${device.device} → Mounted at ${device.mountpoint} (${device.fstype})` : mountpoint}
                    </Typography>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Step 1: Checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
            }
            label="I understand that this action cannot be undone"
          />

          {/* Step 2: Aadhaar Input + Get OTP */}
          {confirmed && (
            <Box mt={2}>
              <TextField
                label="Enter Aadhaar Number"
                variant="outlined"
                fullWidth
                value={aadhar}
                onChange={(e) => setAadhar(e.target.value)}
              />
              <Button
                variant="contained"
                sx={{ mt: 1 }}
                onClick={handleSendOtp}
              >
                Get OTP
              </Button>
            </Box>
          )}

          {/* Step 3: OTP Input + Verify */}
          {otpSent && !verified && (
            <Box mt={2}>
              <TextField
                label="Enter OTP"
                variant="outlined"
                fullWidth
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <Button
                variant="contained"
                sx={{ mt: 1 }}
                onClick={handleVerifyOtp}
              >
                Verify OTP
              </Button>
            </Box>
          )}

          {/* Step 4: Proceed Wipe */}
          {verified && (
            <Box mt={2}>
              <Button
                variant="contained"
                color="error"
                onClick={handleProceedWipe}
              >
                Proceed Wipe
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenWarning(false)}>Cancel</Button>
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
