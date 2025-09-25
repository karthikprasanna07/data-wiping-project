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
    <Box className="app-container" sx={{ fontFamily: '"Poppins", sans-serif' }}>
      {/* Top Bar */}
      <AppBar position="static" className="topbar">
        <Toolbar>
          <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1 }}>
            <img
              src="/logobg.png" // adjust path based on where you store it
              alt="logo"
              style={{ height: "50px", marginRight: "8px" }}
            />
            <Typography variant="h6" sx={{ flexGrow: 1, fontFamily: '"Poppins", sans-serif' }}>
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
          <Typography variant="h6" sx={{ mb: 2, color: '#b71c1c', fontFamily: '"Poppins", sans-serif' }}>Select device(s):</Typography>

          {devices.length === 0 ? (
            <Typography sx={{ color: '#d32f2f', fontFamily: '"Poppins", sans-serif' }}>No devices detected</Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: "0 10px"
              }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #b71c1c" }}>
                    <th style={{ textAlign: "left", padding: "12px", paddingLeft: "24px", color: '#424242', fontFamily: '"Poppins", sans-serif' }}>Device Name</th>
                    <th style={{ textAlign: "center", padding: "12px", color: '#424242', fontFamily: '"Poppins", sans-serif' }}>Mount Point</th>
                    <th style={{ textAlign: "center", padding: "12px", color: '#424242', fontFamily: '"Poppins", sans-serif' }}>File System</th>
                    <th style={{ textAlign: "center", padding: "12px", color: '#424242', fontFamily: '"Poppins", sans-serif' }}>Total Size</th>
                    <th style={{ textAlign: "center", padding: "12px", color: '#424242', fontFamily: '"Poppins", sans-serif' }}>Occupied Space</th>
                    <th style={{ textAlign: "center", padding: "12px", color: '#424242', fontFamily: '"Poppins", sans-serif' }}>Select</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d, idx) => {
                    return (
                      <tr
                        key={idx}
                        style={{
                          backgroundColor: selectedDevices.includes(d.mountpoint) ? "#ffebee" : "transparent",
                          cursor: "pointer",
                          transition: 'background-color 0.3s ease',
                          borderRadius: '4px'
                        }}
                        onClick={() => handleCheckbox(d.mountpoint)}
                      >
                        <td style={{ textAlign: "left", padding: "12px", paddingLeft: "24px", borderTop: '1px solid #fce4ec', borderBottom: '1px solid #fce4ec', fontFamily: '"Poppins", sans-serif' }}>{d.device}</td>
                        <td style={{ textAlign: "center", padding: "12px", borderTop: '1px solid #fce4ec', borderBottom: '1px solid #fce4ec', fontFamily: '"Poppins", sans-serif' }}>{d.mountpoint}</td>
                        <td style={{ textAlign: "center", padding: "12px", borderTop: '1px solid #fce4ec', borderBottom: '1px solid #fce4ec', fontFamily: '"Poppins", sans-serif' }}>{d.fstype}</td>
                        <td style={{ textAlign: "center", padding: "12px", borderTop: '1px solid #fce4ec', borderBottom: '1px solid #fce4ec', fontFamily: '"Poppins", sans-serif' }}>{d.size}</td>
                        <td style={{ textAlign: "center", padding: "12px", borderTop: '1px solid #fce4ec', borderBottom: '1px solid #fce4ec', fontFamily: '"Poppins", sans-serif' }}>{d.used}</td>
                        <td style={{ textAlign: "center", padding: "12px", borderTop: '1px solid #fce4ec', borderBottom: '1px solid #fce4ec', fontFamily: '"Poppins", sans-serif' }}>
                          <Checkbox
                            checked={selectedDevices.includes(d.mountpoint)}
                            onChange={() => handleCheckbox(d.mountpoint)}
                            onClick={(e) => e.stopPropagation()}
                            sx={{ color: '#d32f2f', '&.Mui-checked': { color: '#b71c1c' } }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          )}
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
          sx={{ fontFamily: '"Poppins", sans-serif' }}
        >
          Wipe
        </Button>
      )}

      {/* Warning Dialog */}
      <Dialog open={openWarning} onClose={() => setOpenWarning(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Poppins", sans-serif' }}>⚠️ Confirm Data Wipe</DialogTitle>
        <DialogContent sx={{ fontFamily: '"Poppins", sans-serif' }}>
          <Alert severity="error" sx={{ mb: 2, fontFamily: '"Poppins", sans-serif' }}>
            Warning: This action is <b>permanent</b>. All data on the selected
            device(s) will be <b>unrecoverable</b>.
          </Alert>
          {selectedDevices.length > 0 && (
            <Box sx={{ mb: 2, fontFamily: '"Poppins", sans-serif' }}>
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', fontFamily: '"Poppins", sans-serif' }}>
                Devices selected for wiping:
              </Typography>
              <Box
                sx={{
                  maxHeight: 150,
                  overflowY: 'auto',
                  border: '1px solid #f44336',
                  borderRadius: 1,
                  p: 1,
                  backgroundColor: '#ffebee',
                  fontFamily: '"Poppins", sans-serif'
                }}
              >
                {selectedDevices.map((mountpoint, idx) => {
                  const device = devices.find(d => d.mountpoint === mountpoint);
                  return (
                    <Typography
                      key={idx}
                      variant="body2"
                      sx={{ mb: 0.5, fontFamily: '"Poppins", sans-serif' }}
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
            label={<Typography sx={{ fontFamily: '"Poppins", sans-serif' }}>I understand that this action cannot be undone</Typography>}
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
                sx={{ fontFamily: '"Poppins", sans-serif' }}
              />
              <Button
                variant="contained"
                sx={{ mt: 1, fontFamily: '"Poppins", sans-serif' }}
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
                sx={{ fontFamily: '"Poppins", sans-serif' }}
              />
              <Button
                variant="contained"
                sx={{ mt: 1, fontFamily: '"Poppins", sans-serif' }}
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
                sx={{ fontFamily: '"Poppins", sans-serif' }}
              >
                Proceed Wipe
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenWarning(false)} sx={{ fontFamily: '"Poppins", sans-serif' }}>Cancel</Button>
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
          fontFamily: '"Poppins", sans-serif'
        }}
      >
        <Typography variant="body2" sx={{ fontFamily: '"Poppins", sans-serif' }}>© 2025 WipeX Prototype</Typography>
      </Box>
    </Box>
  );
}

export default App;
