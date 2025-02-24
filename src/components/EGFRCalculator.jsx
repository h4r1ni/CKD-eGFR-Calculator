import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; // <-- Add this at the top
import { auth } from "../firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";

import {
  Box,
  Container,
  Paper,
  Tabs,
  Tab,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Grid,
  Divider,
  Stack,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CalculateIcon from '@mui/icons-material/Calculate';
import Papa from 'papaparse';

const EGFRCalculator = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialUserType = queryParams.get('type') || 'clinician';
  const [userType, setUserType] = useState(initialUserType);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [calculationResult, setCalculationResult] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [patients, setPatients] = useState([]); // Stores multiple patient data
  const [currentPatientIndex, setCurrentPatientIndex] = useState(0); // Controls navigation

  
  useEffect(() => {
    setUserType(initialUserType);
  }, [initialUserType]);
  

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      age: '',
      gender: '',
      ethnicity: '',
      creatinine: '',
    },
  });

  const handleUserTypeChange = (event, newValue) => {
    setUserType(newValue);
    reset();
    setCalculationResult(null);
    setError('');
  };

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsLoggedIn(true);
    } catch (error) {
      setLoginError("Invalid credentials. Please try again.");
    }
  };
  

  const calculateEGFR = (creatinine, age, gender, ethnicity) => {
    // MDRD equation implementation
    let egfr = 175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203);
    
    // Apply gender factor
    if (gender === 'female') {
      egfr *= 0.742;
    }
    
    // Apply ethnicity factor
    if (ethnicity === 'african') {
      egfr *= 1.212;
    }
    
    return egfr.toFixed(2);
  };

  const getCKDStage = (egfr) => {
    if (egfr >= 90) return '1';
    if (egfr >= 60) return '2';
    if (egfr >= 30) return '3';
    if (egfr >= 15) return '4';
    return '5';
  };

  const onSubmit = (data) => {
    setLoading(true);
    try {
      const egfr = calculateEGFR(
        parseFloat(data.creatinine),
        parseFloat(data.age),
        data.gender,
        data.ethnicity
      );
      
      const stage = getCKDStage(egfr);
      
      setCalculationResult({
        egfr,
        stage,
        recommendations: getRecommendations(stage),
      });
      
    } catch (err) {
      setError('Error calculating eGFR. Please check your inputs.');
    }
    setLoading(false);
  };

    const handleFileUpload = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    Papa.parse(file, {
        complete: (results) => {
            if (results.errors.length) {
                setError(`Error processing CSV file: ${results.errors[0].message}`);
                return;
            }

            const patients = results.data.map((row, index) => {
                // Normalize column names (force lowercase and trim spaces)
                const normalizedRow = {};
                Object.keys(row).forEach(key => {
                    normalizedRow[key.trim().toLowerCase()] = row[key].trim();
                });

                // Check if any required fields are missing
                if (!normalizedRow.age || !normalizedRow.gender || !normalizedRow.ethnicity || !normalizedRow.creatinine) {
                    setError(`Missing required fields in row ${index + 1}. Please check your file.`);
                    return null;
                }

                // Validate values
                if (isNaN(normalizedRow.age) || isNaN(normalizedRow.creatinine)) {
                    setError(`Invalid number detected in row ${index + 1}. Ensure age and creatinine are numeric.`);
                    return null;
                }

                return normalizedRow;
            }).filter(patient => patient !== null);  // Remove invalid entries

            if (patients.length === 0) {
                setError('CSV file is empty or all rows contain errors. Please check your file.');
                return;
            }

            setPatients(patients);
            setCurrentPatientIndex(0);
            setError(''); // Clear any previous errors
        },
        header: true,
        skipEmptyLines: true,
    });
};

  
  useEffect(() => {
    if (patients.length > 0) {
      const selectedPatient = patients[currentPatientIndex];
      setValue("age", selectedPatient.age);
      setValue("gender", selectedPatient.gender.toLowerCase());
      setValue("ethnicity", selectedPatient.ethnicity.toLowerCase());
      setValue("creatinine", selectedPatient.creatinine);
    }
  }, [currentPatientIndex, patients, setValue]);
  
  

  const getRecommendations = (stage) => {
    const recommendations = {
      '1': 'Monitor kidney function annually. Maintain healthy lifestyle.',
      '2': 'Monitor kidney function bi-annually. Control blood pressure.',
      '3': 'Consult nephrologist. Monitor every 3-6 months.',
      '4': 'Regular nephrologist visits. Prepare for possible kidney replacement.',
      '5': 'Immediate medical attention required. Discuss treatment options.'
    };
    return recommendations[stage];
  };

  return (
    <Container 
      maxWidth="lg" 
      sx={{ 
        width: '100%',
        maxWidth: 'none !important',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Paper 
        elevation={0}
        sx={{ 
          p: { xs: 2, sm: 4 },
          mb: 4,
          textAlign: 'center',
          background: 'transparent',
          width: '100%',
        }}
      >
        <Typography 
          variant="h4" 
          gutterBottom 
          sx={{
            fontSize: { xs: '1.75rem', sm: '2.125rem' },
            mb: 1,
          }}
        >
          CKD eGFR Calculator
        </Typography>
        <Typography 
          variant="body1" 
          color="text.secondary"
          sx={{ mb: 3 }}
        >
          Calculate estimated Glomerular Filtration Rate (eGFR) using the MDRD equation
        </Typography>
      </Paper>

      <Paper 
        elevation={2}
        sx={{ 
          p: { xs: 2, sm: 4 },
          mb: 4,
          boxShadow: '0px 4px 20px rgba(0,0,0,0.05)',
          width: '100%',
        }}
      >
        <Tabs
          value={userType}
          onChange={(e, newValue) => {
            setUserType(newValue);
            reset();
            setCalculationResult(null);
            setError('');
          }}
          centered
          sx={{
            mb: 4,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab 
            label="Patient" 
            value="patient"
            sx={{ 
              fontSize: '1rem',
              fontWeight: 500,
            }}
          />
          <Tab 
            label="Clinician" 
            value="clinician"
            sx={{ 
              fontSize: '1rem',
              fontWeight: 500,
            }}
          />
        </Tabs>


        {userType === "clinician" && !isLoggedIn ? (
          <Box sx={{ textAlign: "center", mt: 3 }}>
            <Typography variant="h6">Clinician Login</Typography>
            <TextField
              label="Email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={handleLogin}
              sx={{ mt: 2 }}
            >
              Login
            </Button>
            {loginError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {loginError}
              </Alert>
            )}
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}
            <form onSubmit={handleSubmit(onSubmit)}>
              <Grid container spacing={3}>
              {patients.length > 1 && (
          <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button 
              variant="contained" 
              color="secondary" 
              disabled={currentPatientIndex === 0} 
              onClick={() => setCurrentPatientIndex(prev => prev - 1)}
            >
              ← Previous Patient
            </Button>

            <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center' }}>
              Patient {currentPatientIndex + 1} of {patients.length}
            </Typography>

            <Button 
              variant="contained" 
              color="secondary" 
              disabled={currentPatientIndex === patients.length - 1} 
              onClick={() => setCurrentPatientIndex(prev => prev + 1)}
            >
              Next Patient →
            </Button>
          </Grid>
        )}

        <Grid item xs={12} md={6}>
          <Controller
            name="age"
            control={control}
            rules={{ required: 'Age is required', min: 18, max: 120 }}
            render={({ field }) => (
              <TextField {...field} label="Age" type="number" fullWidth error={!!errors.age} helperText={errors.age?.message} />
            )}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Controller
            name="gender"
            control={control}
            rules={{ required: 'Gender is required' }}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.gender}>
                <InputLabel>Gender</InputLabel>
                <Select {...field} label="Gender">
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Controller
            name="ethnicity"
            control={control}
            rules={{ required: 'Ethnicity is required' }}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.ethnicity}>
                <InputLabel>Ethnicity</InputLabel>
                <Select {...field} label="Ethnicity">
                  <MenuItem value="african">African</MenuItem>
                  <MenuItem value="non-african">Non-African</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Controller
            name="creatinine"
            control={control}
            rules={{ 
              required: 'Creatinine level is required',
              min: { value: 0.1, message: 'Invalid creatinine level' },
              max: { value: 20, message: 'Invalid creatinine level' }
            }}
            render={({ field }) => (
              <TextField {...field} label="Creatinine Level (mg/dL)" type="number" fullWidth error={!!errors.creatinine} helperText={errors.creatinine?.message} />
            )}
          />
        </Grid>
        <Grid item xs={12}>
        <Button
          component="label"
          variant="outlined"
          startIcon={<CloudUploadIcon />}
          fullWidth
          sx={{ 
            height: 56,
            borderStyle: 'dashed',
          }}
        >
          Upload Patient Data (CSV)
          <input
            type="file"
            hidden
            accept=".csv"
            onChange={handleFileUpload} // Make sure this function is handling the upload
          />
        </Button>
      </Grid>

              <Grid item xs={12}>
                <Button type="submit" variant="contained" color="primary" fullWidth disabled={loading} startIcon={loading ? <CircularProgress size={20} /> : <CalculateIcon />} sx={{ height: 56, fontSize: '1.1rem' }}>
                  {loading ? 'Calculating...' : 'Calculate eGFR'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </>
      )}
      </Paper>

      {calculationResult && (
        <Paper 
          elevation={2}
          sx={{ 
            p: { xs: 2, sm: 4 },
            boxShadow: '0px 4px 20px rgba(0,0,0,0.05)',
            width: '100%',
          }}
        >
          <Stack spacing={3}>
            <Typography 
              variant="h5" 
              gutterBottom
              sx={{ 
                textAlign: 'center',
                mb: 3,
              }}
            >
              Results
            </Typography>

            <Box sx={{ 
              display: 'flex',
              justifyContent: 'center',
              gap: 4,
              flexWrap: 'wrap'
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h4" 
                  color="primary"
                  sx={{ mb: 1 }}
                >
                  {calculationResult.egfr}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                >
                  mL/min/1.73m²
                </Typography>
              </Box>

              <Divider orientation="vertical" flexItem />

              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h4" 
                  color="secondary"
                  sx={{ mb: 1 }}
                >
                  Stage {calculationResult.stage}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                >
                  CKD Stage
                </Typography>
              </Box>
            </Box>

            <Divider />

            <Box>
              <Typography 
                variant="subtitle1" 
                color="text.secondary"
                gutterBottom
              >
                Recommendations
              </Typography>
              <Typography variant="body1">
                {calculationResult.recommendations}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}
    </Container>
  );
};

export default EGFRCalculator;
