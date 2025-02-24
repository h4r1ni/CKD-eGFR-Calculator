import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, Button, TextField } from '@mui/material';

const Login = ({ onLogin }) => {
  const [clinicianID, setClinicianID] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = () => {
    if (clinicianID === 'admin' && password === 'password') {
      onLogin();
      navigate('/calculator?type=clinician');
    } else {
      setError('Invalid Clinician ID or Password');
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
      <Paper elevation={3} sx={{ padding: 4, borderRadius: 2 }}>
        <Typography variant="h4" gutterBottom>Clinician Login</Typography>
        
        <TextField
          label="Clinician ID"
          fullWidth
          margin="normal"
          value={clinicianID}
          onChange={(e) => setClinicianID(e.target.value)}
        />
        
        <TextField
          label="Password"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        
        {error && <Typography color="error">{error}</Typography>}
        
        <Button variant="contained" color="primary" fullWidth onClick={handleLogin}>
          Login
        </Button>
      </Paper>
    </Box>
  );
};

export default Login;
