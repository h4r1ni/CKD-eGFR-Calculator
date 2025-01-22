import React, { useState } from 'react';
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
  const [userType, setUserType] = useState('patient');
  const [calculationResult, setCalculationResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
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
    if (file) {
      Papa.parse(file, {
        complete: (results) => {
          // Process CSV data
          console.log(results.data);
          // Implement bulk processing logic here
        },
        header: true,
        error: (error) => {
          setError('Error processing CSV file: ' + error.message);
        }
      });
    }
  };

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

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: 2,
            }}
          >
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Controller
                name="age"
                control={control}
                rules={{ required: 'Age is required', min: 18, max: 120 }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Age"
                    type="number"
                    fullWidth
                    error={!!errors.age}
                    helperText={errors.age?.message}
                  />
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
                  <TextField
                    {...field}
                    label="Creatinine Level (mg/dL)"
                    type="number"
                    fullWidth
                    error={!!errors.creatinine}
                    helperText={errors.creatinine?.message}
                  />
                )}
              />
            </Grid>

            {userType === 'clinician' && (
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
                    onChange={handleFileUpload}
                  />
                </Button>
              </Grid>
            )}

            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <CalculateIcon />}
                sx={{ 
                  height: 56,
                  fontSize: '1.1rem',
                }}
              >
                {loading ? 'Calculating...' : 'Calculate eGFR'}
              </Button>
            </Grid>
          </Grid>
        </form>
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
