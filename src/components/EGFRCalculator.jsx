import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { db, auth } from "../firebaseConfig";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import {collection, setDoc, doc, getDoc, addDoc, serverTimestamp } from "firebase/firestore";


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
  const [isRegistering, setIsRegistering] = useState(false); // Tracks if user is registering
  const [registerSource, setRegisterSource] = useState(null); // Tracks whether user clicked "Register" or "Remember Me"
  const [savedPatientData, setSavedPatientData] = useState(null); // Stores last entered values if from "Remember Me"
  const initialUserType = queryParams.get('type') || 'patient';
  const [userType, setUserType] = useState(initialUserType);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [calculationResult, setCalculationResult] = useState(null);
  const [creatinineUnit, setCreatinineUnit] = useState('mg/dL'); // Default to mg/dL
  const [nhsNumber, setNhsNumber] = useState("");
  const [password, setPassword] = useState("");
  const [hcpId, setHcpId] = useState("");
  const [loginError, setLoginError] = useState("");
  const [patients, setPatients] = useState([]); // Stores multiple patient data
  const [currentPatientIndex, setCurrentPatientIndex] = useState(0); // Controls navigation
  const [currentNhsNumber, setCurrentNhsNumber] = useState("");
  const [role, setRole] = useState(null);
  const [isPediatricMode, setPediatricMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // const initialUserType = new URLSearchParams(useLocation().search).get('type') || 'patient';


  const getPediatricRecommendations = (egfr) => {
    if (egfr >= 90) return "Normal kidney function. Monitor growth and development.";
    if (egfr >= 60) return "Mild kidney disease. Regular monitoring is recommended.";
    if (egfr >= 30) return "Moderate kidney disease. Consult a pediatric nephrologist.";
    if (egfr >= 15) return "Severe kidney disease. Immediate medical intervention required.";
    return "Kidney failure. Urgent medical care required.";
  };

  
  const onSubmitPediatric = (data) => {
    setLoading(true);
    try {
      const { age, height, gender, creatinine, creatinineUnit } = data;
      let creatinineMgDl = parseFloat(creatinine);
      const unitLower = creatinineUnit ? creatinineUnit.toLowerCase() : "mg/dl";

      if (unitLower === "micromol/l" || unitLower === "µmol/l") {
        creatinineMgDl = creatinineMgDl / 88.4;
      } 
      if (isNaN(creatinineMgDl) || creatinineMgDl <= 0) {
        setError("Invalid creatinine value.");
        setLoading(false);
        return;
      }
      if (isNaN(height) || height <= 0) {
        setError("Invalid height value.");
        setLoading(false);
        return;
      }
      
      const kValue = 0.413;
      const egfr = (kValue * parseFloat(height)) / creatinineMgDl;
      const stage = getCKDStage(egfr);
      
      setCalculationResult({
        egfr: egfr.toFixed(2),
        stage,
        recommendations: getPediatricRecommendations(egfr),
      });
    } catch (err) {
      console.error("Error in pediatric calculation:", err);
      setError("Error calculating Pediatric eGFR. Please check your inputs.");
    }
    setLoading(false);
  };
  
  
  
  
  useEffect(() => {
    setUserType(initialUserType);
  }, [initialUserType]);
  



  const { control, handleSubmit, reset, setValue, getValues, formState: { errors } } = useForm({
    defaultValues: {
      age: '',
      height: '',
      gender: '',
      ethnicity: '',
      creatinine: '',
      unit: '',  // Default unit
    },
  });
  
  const getIP = async () => {
    try {
      const response = await fetch("https://api64.ipify.org?format=json");
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error("Error fetching IP:", error);
      return "Unknown";
    }
  };

  const handleClinicianLogin = async () => {
    try {
        if (!hcpId) {
            alert("HCP ID is required!");
            return;
        }
        if (!password || password.length < 6) {
            alert("Password must be at least 6 characters!");
            return;
        }
        // Convert HCP ID to a dummy email format
        const hcpEmail = `${hcpId}@hcp.com`;
        await signInWithEmailAndPassword(auth, hcpEmail, password);
        setIsLoggedIn(true);
        setRole("clinician");
        console.log("Successfully logged in as HCP:", hcpId);
        // Return the clinician to the calculator view:
        setIsRegistering(false);
        setRegisterSource(null);
        alert("Clinician Login successful!");
        const login = await getIP();
        const loginTime = new Date().toJSON();
        try {
          await setDoc(doc(db, "attemptlog", `cli_${hcpId}_${loginTime}`), {
            type: "clinician",
            id: hcpId || "Unknown",
            timestamp: serverTimestamp(),
            ip: login,
            status: "success"
          });
          console.log("Successful login recorded.");
        } catch (error) {
          console.error("Error logging attempt:", error.message);
        }
        
    } catch (error) {
        console.error("Clinician Login error:", error.message);
        setLoginError("Invalid credentials. Please try again.");

        const offence = await getIP();
        const offenceTime = new Date().toJSON();
        try {
          await setDoc(doc(db, "attemptlog", `FAIL_cli_${hcpId}_${offenceTime}`), {
            type: "clinician",
            id: hcpId || "Unknown",
            timestamp: serverTimestamp(),
            ip: offence,
            status: "failed"
          });
          console.log("Suspicious login attempt recorded.");
        } catch (error) {
          console.error("Error logging attempt:", error.message);
        }
        
    }
  };
  

  
const handlePatientRegister = async () => {
  try {
      console.log("Register button clicked!");
      console.log("Register Source:", registerSource);
      console.log("Saved Patient Data:", savedPatientData);

      if (!nhsNumber || !/^\d{10}$/.test(nhsNumber)) {
          alert("NHS Number must be exactly 10 digits and contain only numbers!");
          return;
      }

      if (!password || password.length < 6) {
          alert("Password must be at least 6 characters!");
          return;
      }

      // Convert NHS Number into a valid Firebase email format for the authenticator
      const nhsEmail = `${nhsNumber}@nhsuser.com`;

      // Create User in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, nhsEmail, password);
      const userId = userCredential.user.uid;

      // Stors the  NHS number and patient data in Firestore
      const patientData = {
          nhsNumber,
          age: registerSource === "rememberMe" && savedPatientData ? savedPatientData.age : null,
          gender: registerSource === "rememberMe" && savedPatientData ? savedPatientData.gender : null,
          ethnicity: registerSource === "rememberMe" && savedPatientData ? savedPatientData.ethnicity : null,
          creatinine: registerSource === "rememberMe" && savedPatientData ? savedPatientData.creatinine : null,
          unit: registerSource === "rememberMe" && savedPatientData ? savedPatientData.unit : null,
          timestamp: new Date(),
      };

      // Save Patient Data in Firestore using NHS Number

      await setDoc(doc(db, "patients", nhsNumber), patientData);

      // Set the user as logged in so that the Logout button is shown
      setIsLoggedIn(true);
      setCurrentNhsNumber(nhsNumber);


      // Reset state to show the calculator view (with logout) instead of registration
      setIsRegistering(false);
      setRegisterSource(null);
      setSavedPatientData(null);
      setNhsNumber("");
      setPassword("");

      alert("Registration successful!");

  } catch (error) {
      console.error("Error registering:", error.message);
      alert("Error registering: " + error.message);
  }
};



const handlePatientLogin = async () => {
  try {
      console.log("Login button clicked!");

      if (!nhsNumber || !/^\d{10}$/.test(nhsNumber)) {
          alert("NHS Number must be exactly 10 digits and contain only numbers!");
          return;
      }
      if (!password || password.length < 6) {
          alert("Password must be at least 6 characters!");
          return;
      }

      const nhsEmail = `${nhsNumber}@nhsuser.com`;

      await signInWithEmailAndPassword(auth, nhsEmail, password);
      setIsLoggedIn(true);
      setRole("patient");
      setCurrentNhsNumber(nhsNumber);

      // These lines will send the user back to the calculator view
      setIsRegistering(false);
      setRegisterSource(null);

      const fetchPatientData = async (nhsNum) => {
        try {
          const docRef = doc(db, "patients", nhsNum);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const patientData = docSnap.data();
            // Use setValue to prefill your form fields:
            setValue("age", patientData.age);
            setValue("gender", patientData.gender);
            setValue("ethnicity", patientData.ethnicity);
            setValue("creatinine", patientData.creatinine);
            setCreatinineUnit(patientData.unit);
          }
        }
        catch (error) {
          console.error("Error sending data", error.message);
          setLoginError("Error sending data to database. Please try again.");
        }
      }
      fetchPatientData(nhsNumber);
      console.log("Successfully logged in as:", nhsNumber);
      alert("🎉 Login successful!");
      const login = await getIP();
      const loginTime = new Date().toJSON();
      try {
        await setDoc(doc(db, "attemptlog", `pat_${nhsNumber}_${loginTime}`), {
          type: "patient",
          id: nhsNumber || "Unknown",
          timestamp: serverTimestamp(),
          ip: login,
          status: "success"
        });
        console.log("Successful login recorded.");
      } catch (error) {
        console.error("Error logging attempt:", error.message);
      }

      
  } catch (error) {
      console.error("Login error:", error.message);
      setLoginError("Invalid credentials. Please try again.");
      const offence = await getIP();
      const offenceTime = new Date().toJSON();
      try {
        await setDoc(doc(db, "attemptlog", `FAIL_pat_${nhsNumber}_${offenceTime}`), {
          type: "patient",
          id: nhsNumber || "Unknown",
          timestamp: serverTimestamp(),
          ip: offence,
          status: "failed"
        });
        console.log("Suspicious login attempt recorded.");
      } catch (error) {
        console.error("Error logging attempt:", error.message);
      }
  }
};


  

function calculateEGFR(creatinine, age, gender, ethnicity, unit) {
  let creatinineMgDl = parseFloat(creatinine);
  if (unit === "micromol/L") {
    creatinineMgDl = creatinineMgDl / 88.4;
  }


  if (isNaN(creatinineMgDl) || creatinineMgDl <= 0) {
    return "Invalid";
  }

  let egfr = 186
    * Math.pow(creatinineMgDl, -1.154)
    * Math.pow(age, -0.203);

  if (gender.toLowerCase() === "female") {
    egfr *= 0.742;
  }

  if (ethnicity.toLowerCase() === "black") {
    egfr *= 1.210;
  }

  return egfr.toFixed(2);
}


  const getCKDStage = (egfr) => {
    if (egfr >= 90) return '1';
    if (egfr >= 60) return '2';
    if (egfr >= 30) return '3';
    if (egfr >= 15) return '4';
    return '5';
  };

  const [showRememberMeButton, setShowRememberMeButton] = useState(false);
  const onSubmit = (data) => {
    setLoading(true);
    try {
        const egfr = calculateEGFR(
            parseFloat(data.creatinine),
            parseFloat(data.age),
            data.gender,
            data.ethnicity,
            creatinineUnit
        );

        const stage = getCKDStage(egfr);

        setCalculationResult({
            egfr,
            stage,
            recommendations: getRecommendations(stage),
        });

        setShowRememberMeButton(true);

        console.log("Unit Passed:", creatinineUnit);
    } catch (err) {
        setError('Error calculating eGFR. Please check your inputs.');
    }
    console.log("Selected Unit Before Calculation:", creatinineUnit);
    setLoading(false);
};


  const handleFileUpload = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const batchTime = new Date().toJSON();
    try {
      setDoc(doc(db, "batch", `${hcpId}_${batchTime}`), {
      clinician: hcpId || "Unknown",
      timestamp: serverTimestamp(),
      file: file.name
    });
    console.log("Batch use recorded.");
    } catch (error) {
      console.error("Error logging batch use:", error.message);
    }

    Papa.parse(file, {
      complete: (results) => {
        if (results.errors.length) {
          setError(`Error processing CSV file: ${results.errors[0].message}`);
          return;
        }
    
        const patientsData = results.data.map((row, index) => {
          const normalizedRow = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.trim().toLowerCase()] = row[key] ? row[key].trim() : "";
          });
    
          if (
            !normalizedRow.age ||
            !normalizedRow.gender ||
            !normalizedRow.ethnicity ||
            !normalizedRow.creatinine ||
            !normalizedRow.unit
          ) {
            setError(`Missing required fields in row ${index + 1}. Please check your file.`);
            return null;
          }
    
          if (isNaN(normalizedRow.age) || isNaN(normalizedRow.creatinine)) {
            setError(`Invalid number detected in row ${index + 1}. Ensure age and creatinine are numeric.`);
            return null;
          }
    
          let unit = normalizedRow.unit.toLowerCase().replace(/\s/g, "");
          if (unit === "mg/dl" || unit === "mgdl") {
            unit = "mg/dL";
          } else if (
            ["micromol/l", "µmol/l", "micromoll", "μmol/l", "umol/l", "μmoll", "m/l"].includes(unit)
          ) {
            unit = "micromol/L";
          } else {
            setError(`Invalid unit in row ${index + 1}: "${normalizedRow.unit}". Must be "mg/dL" or "micromol/L".`);
            return null;
          }
    
          return {
            age: normalizedRow.age,
            gender: normalizedRow.gender.toLowerCase(),
            ethnicity: normalizedRow.ethnicity.toLowerCase(),
            creatinine: normalizedRow.creatinine,
            unit,
          };
        }).filter(patient => patient !== null);
    
        if (patientsData.length === 0) {
          setError('CSV file is empty or all rows contain errors. Please check your file.');
          return;
        }
    
        // Update state and reset form fields with first patient’s data:
        setPatients(patientsData);
        setCurrentPatientIndex(0);
        reset({
          age: patientsData[0].age,
          gender: patientsData[0].gender,
          ethnicity: patientsData[0].ethnicity,
          creatinine: patientsData[0].creatinine,
          unit: patientsData[0].unit,
        });
        setError('');
      },
      header: true,
      skipEmptyLines: true,
    });    
};

    useEffect(() => {
      if (patients.length > 0) {
          const selectedPatient = patients[currentPatientIndex];
          setValue("age", selectedPatient.age);
          setValue("gender", selectedPatient.gender);
          setValue("ethnicity", selectedPatient.ethnicity);
          setValue("creatinine", selectedPatient.creatinine);
          setCreatinineUnit(selectedPatient.unit);
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
            // If role === 'patient' and user clicks "Clinician", do nothing
            if (role === 'patient' && newValue === 'clinician') {
              alert("You are logged in as a patient and cannot access the Clinician tab.");
              return;
            }
            reset();
            setCalculationResult(null);
            setError('');
            setUserType(newValue);
    
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
            sx={{ fontSize: '1rem', fontWeight: 500 }}
          />
            <Tab
              label="Clinician"
              value="clinician"
              disabled={role === 'patient'}
              sx={{ fontSize: '1rem', fontWeight: 500 }}
            />
        </Tabs>




        {userType === "clinician" && !isLoggedIn ? (
        <Box sx={{ textAlign: "center", mt: 3 }}>
          <Typography variant="h6">Clinician Login</Typography>
            <TextField
              label="HCP ID"
              fullWidth
              margin="normal"
              value={hcpId}
              onChange={(e) => setHcpId(e.target.value)}
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
            onClick={handleClinicianLogin}
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
      ) : userType === "clinician" && isLoggedIn ? (
        <Box sx={{ textAlign: "center", mt: 3 }}>
          {patients.length > 1 && (
            <Grid container spacing={2} justifyContent="center" sx={{ mb: 2 }}>
              <Grid item>
                <Button
                  variant="contained"
                  color="success"
                  disabled={currentPatientIndex === 0}
                  onClick={() => setCurrentPatientIndex((prev) => prev - 1)}
                >
                  ← Previous Patient
                </Button>
              </Grid>
              <Grid item>
                <Typography variant="body1" sx={{ display: "flex", alignItems: "center" }}>
                  Patient {currentPatientIndex + 1} of {patients.length}
                </Typography>
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  color="success"
                  disabled={currentPatientIndex === patients.length - 1}
                  onClick={() => setCurrentPatientIndex((prev) => prev + 1)}
                >
                  Next Patient →
                </Button>
              </Grid>
            </Grid>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="age"
                  control={control}
                  rules={{
                    required: "Age is required",
                    min: { value: 18, message: "Patients must be 18 or older" },
                    max: { value: 110, message: "Patients cannot be older than 110" },
                  }}
                  render={({ field }) => (
                    <TextField {...field} label="Age" type="number" fullWidth error={!!errors.age} helperText={errors.age?.message} />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="gender"
                  control={control}
                  rules={{ required: "Gender is required" }}
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
                  rules={{ required: "Ethnicity is required" }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.ethnicity}>
                      <InputLabel>Ethnicity</InputLabel>
                      <Select {...field} label="Ethnicity">
                        <MenuItem value="black">Black</MenuItem>
                        <MenuItem value="non-black">Non-Black</MenuItem>
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
                    required: "Creatinine level is required",
                    min: { value: 0.1, message: "Invalid creatinine level" },
                    max: { value: 2000, message: "Invalid creatinine level" },
                  }}
                  render={({ field }) => (
                    <TextField {...field} label="Creatinine Level" type="number" fullWidth error={!!errors.creatinine} helperText={errors.creatinine?.message} />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Unit</InputLabel>
                  <Select value={creatinineUnit} onChange={(e) => setCreatinineUnit(e.target.value)}>
                    <MenuItem value="mg/dL">mg/dL</MenuItem>
                    <MenuItem value="micromol/L">micromol/L</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  fullWidth
                  sx={{
                    height: 56,
                    borderStyle: "dashed",
                  }}
                >
                  Upload Patient Data (CSV)
                  <input type="file" hidden accept=".csv" onChange={handleFileUpload} />
                </Button>
              </Grid>

              <Grid item xs={12}>
                <Button type="submit" variant="contained" color="primary" fullWidth disabled={loading} startIcon={loading ? <CircularProgress size={20} /> : <CalculateIcon />} sx={{ height: 56, fontSize: "1.1rem" }}>
                  {loading ? "Calculating..." : "Calculate eGFR"}
                </Button>
              </Grid>
            </Grid>
          </form>

          {/* Logout Button */}
          <Button
            variant="contained"
            color="secondary"
            sx={{ mt: 3 }}
            onClick={() => {
              setIsLoggedIn(false);
              setHcpId("");
              setPassword("");
              setCalculationResult(null);
              setRole(null);
              setPatients([]);
              setCurrentPatientIndex(0);
              setCreatinineUnit('mg/dL');
              reset({
                age: '',
                gender: '',
                ethnicity: '',
                creatinine: '',
                unit: 'mg/dL',
              });
            }}
          >
            Logout
          </Button>
        </Box>
        ) : (
          <>
          {userType === "patient" && (
            isRegistering ? (
              registerSource === "register" || registerSource === "rememberMe" ? (
                // PATIENT REGISTRATION FORM
                <Box sx={{ textAlign: "center", mt: 3 }}>
                  <Typography variant="h6">Patient Registration</Typography>

                  {/* NHS Field */}
                  <TextField
                    label="NHS Number"
                    fullWidth
                    margin="normal"
                    value={nhsNumber}
                    onChange={(e) => setNhsNumber(e.target.value)}
                  />

                  {/* Password Field */}
                  <TextField
                    label="Password"
                    type="password"
                    fullWidth
                    margin="normal"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  {registerSource === "rememberMe" && savedPatientData && (
                    <>
                      <Typography variant="subtitle1" sx={{ mt: 2 }}>
                        Saved Patient Information
                      </Typography>
                      <Typography variant="body2">
                        Your data will be saved upon registration.
                      </Typography>
                    </>
                  )}

                  {/* Register Button */}
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={handlePatientRegister}
                    sx={{ mt: 2 }}
                  >
                    Register
                  </Button>

                  {/* Cancel Button */}
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => {
                      setIsRegistering(false);
                      setRegisterSource(null);
                    }}
                    sx={{ mt: 2 }}
                  >
                    Cancel
                  </Button>
                </Box>
              ) : registerSource === "login" ? (
                //  PATIENT LOGIN FORM 
                <Box sx={{ textAlign: "center", mt: 3 }}>
                  <Typography variant="h6">Patient Login</Typography>

                  {/* NHS Number Input */}
                  <TextField
                    label="NHS Number"
                    fullWidth
                    margin="normal"
                    value={nhsNumber}
                    onChange={(e) => setNhsNumber(e.target.value)}
                  />

                  {/* Password Input */}
                  <TextField
                    label="Password"
                    type="password"
                    fullWidth
                    margin="normal"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  {/* Login Button */}
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={handlePatientLogin}
                    sx={{ mt: 2 }}
                  >
                    Login
                  </Button>

                  {/* Error Message */}
                  {loginError && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {loginError}
                    </Alert>
                  )}

                  {/* Cancel Button */}
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => {
                      setIsRegistering(false);
                      setRegisterSource(null);
                    }}
                    sx={{ mt: 2 }}
                  >
                    Cancel
                  </Button>
                </Box>
              ) : (
                // NEITHER REGISTER NOR LOGIN PICKED
                <Box sx={{ textAlign: "center", mt: 3 }}>
                  <Typography variant="h6">
                    Please select Register or Login from the eGFR form
                  </Typography>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => {
                      setIsRegistering(false);
                      setRegisterSource(null);
                    }}
                    sx={{ mt: 2 }}
                  >
                    Cancel
                  </Button>
                </Box>
              )
            ) : isPediatricMode ? (
              <Box sx={{ textAlign: "center", mt: 3 }}>
    <Typography variant="h5">Pediatric eGFR Calculator</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      The standard eGFR formula is not recommended for individuals under 18 years old. Please use the pediatric calculator below.
    </Typography>

    <form onSubmit={handleSubmit(onSubmitPediatric)}>
      <Grid container spacing={3}>
        {/* Age and Height Side by Side */}
        <Grid item xs={12} md={6}>
          <Controller
            name="age"
            control={control}
            rules={{
              required: "Age is required",
              min: { value: 1, message: "Minimum age is 1 year" },
              max: { value: 17, message: "This calculator is for ages under 18" },
            }}
            render={({ field }) => (
              <TextField {...field} label="Age (Years)" type="number" fullWidth error={!!errors.age} helperText={errors.age?.message} />
            )}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Controller
            name="height"
            control={control}
            rules={{
              required: "Height is required",
              min: { value: 30, message: "Height must be at least 30 cm" },
              max: { value: 200, message: "Height must be below 200 cm" },
            }}
            render={({ field }) => (
              <TextField {...field} label="Height (cm)" type="number" fullWidth error={!!errors.height} helperText={errors.height?.message} />
            )}
          />
        </Grid>

        {/* Gender and Serum Creatinine Side by Side */}
        <Grid item xs={12} md={6}>
          <Controller
            name="gender"
            control={control}
            rules={{ required: "Gender is required" }}
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
            name="creatinine"
            control={control}
            rules={{
              required: "Serum Creatinine is required",
              min: { value: 0.1, message: "Invalid creatinine level" },
              max: { value: 2000, message: "Invalid creatinine level" },
            }}
            render={({ field }) => (
              <TextField {...field} label="Serum Creatinine" type="number" fullWidth error={!!errors.creatinine} helperText={errors.creatinine?.message} />
            )}
          />
        </Grid>

        {/* Creatinine Unit */}
        <Grid item xs={12} md={6}>
          <Controller
            name="creatinineUnit"
            control={control}
            defaultValue="micromol/L" // Or "mg/dL" if that's preferred
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Creatinine Unit</InputLabel>
                <Select {...field}>
                  <MenuItem value="mg/dL">mg/dL</MenuItem>
                  <MenuItem value="micromol/L">micromol/L</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        </Grid>
      </Grid>

      {/* Calculate Button */}
      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        sx={{ mt: 3, fontSize: "1.1rem", height: 56 }}
      >
        Calculate Pediatric eGFR
      </Button>

      {/* Back to Main Calculator */}
      <Button
        variant="outlined"
        fullWidth
        onClick={() => {
          setCalculationResult(null);
          setPediatricMode(false);
        }}
        sx={{ mt: 2, fontSize: "1rem" }}
      >
        Back to Main Calculator
      </Button>
    </form>
  </Box>
            ) : (
              // SHOW eGFR FORM WHEN NOT REGISTERING
              <>
                <form onSubmit={handleSubmit(onSubmit)}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="age"
                        control={control}
                        rules={{
                          required: 'Age is required',
                          min: { value: 18, message: 'Patients must be 18 or older' },
                          max: { value: 110, message: 'Patients cannot be older than 110' }
                        }}
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
                              <MenuItem value="black">Black</MenuItem>
                              <MenuItem value="non-black">Non-Black</MenuItem>
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
                          max: { value: 2000, message: 'Invalid creatinine level' }
                        }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Creatinine Level"
                            type="number"
                            fullWidth
                            error={!!errors.creatinine}
                            helperText={errors.creatinine?.message}
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {/* Unit Dropdown */}
                      <FormControl sx={{ flex: 1 }}>
                        <InputLabel>Unit</InputLabel>
                        <Select
                          value={creatinineUnit}
                          onChange={(e) => setCreatinineUnit(e.target.value)}
                        >
                          <MenuItem value="mg/dL">mg/dL</MenuItem>
                          <MenuItem value="micromol/L">micromol/L</MenuItem>
                        </Select>
                      </FormControl>

                      {/* Conditionally show Register/Login OR Logout */}
                      {isLoggedIn ? (
                        // LOGOUT BUTTON ONLY
                        <Button
                          variant="contained"
                          color="secondary"
                          sx={{
                            width: '20%',
                            minWidth: 50,
                            height: 40,
                            fontSize: '0.8rem',
                            textTransform: 'none'
                          }}
                          onClick={() => {
                            // Log out the patient
                            setIsLoggedIn(false);
                            setNhsNumber("");
                            setPassword("");
                            setRegisterSource(null);
                            setCalculationResult(null);
                            setCreatinineUnit('mg/dL');
                            setRole(null);
                            reset({
                              age: "",
                              height: "",
                              gender: "",
                              ethnicity: "",
                              creatinine: "",
                              creatinineUnit: "mg/dL",
                            });
                          }}
                          
                        >
                          Logout
                        </Button>
                      ) : (
                        <>
                          {/* Register Button */}
                          <Button
                            variant="contained"
                            color="secondary"
                            sx={{ width: '20%', minWidth: 50, height: 40, fontSize: '0.8rem', textTransform: 'none' }}
                            onClick={() => {
                              setIsRegistering(true);
                              setCalculationResult(null);
                              setRegisterSource("register");
                              setSavedPatientData(null);
                            }}
                          >
                            Register
                          </Button>

                          {/* Login Button */}
                          <Button
                            variant="contained"
                            color="primary"
                            sx={{ width: '20%', minWidth: 50, height: 40, fontSize: '0.8rem', textTransform: 'none' }}
                            onClick={() => {
                              setIsRegistering(true);
                              setCalculationResult(null);
                              setRegisterSource("login");
                            }}
                          >
                            Login
                          </Button>
                          {/* Are you under 18? Button */}
                          <Button
                            variant="contained"
                            color="warning"
                            sx={{ width: '20%', minWidth: 50, height: 40, fontSize: '0.8rem', textTransform: 'none' }}
                            onClick={() => setPediatricMode(true)}
                          >
                            Under 18?
                          </Button>
                        </>
                      )}
                    </Grid>

                    <Grid item xs={12}>
                      <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        fullWidth
                        disabled={loading}
                        startIcon={
                          loading ? <CircularProgress size={20} /> : <CalculateIcon />
                        }
                        sx={{ height: 56, fontSize: '1.1rem' }}
                      >
                        {loading ? 'Calculating...' : 'Calculate eGFR'}
                      </Button>
                    </Grid>
                  </Grid>
                </form>
              </>
            )
          )}

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}
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
            sx={{ textAlign: 'center', mb: 3 }}
          >
            Results
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary" sx={{ mb: 1 }}>
                {calculationResult.egfr}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                mL/min/1.73m²
              </Typography>
            </Box>

            <Divider orientation="vertical" flexItem />

            <Box sx={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h4" color="secondary" sx={{ mb: 1 }}>
                Stage {calculationResult.stage}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                CKD Stage
              </Typography>

              {userType === "patient" && showRememberMeButton && !isPediatricMode && (
                <Button
                variant="contained"
                color="secondary"
                sx={{
                  width: '25%',
                  minWidth: 100, 
                  height: 55,
                  fontSize: '0.9rem',
                  paddingX: 2,
                  textTransform: 'none',
                }}
                onClick={() => {
                  if (!getValues) {
                    console.error("getValues is not defined!");
                    return;
                  }
                  const rememberedData = {
                    age: getValues("age"),
                    gender: getValues("gender"),
                    ethnicity: getValues("ethnicity"),
                    creatinine: getValues("creatinine"),
                    unit: creatinineUnit,
                  };
                  console.log("Remember Me Clicked! Data:", rememberedData);
                  if (isLoggedIn) {
                    // If logged in, update the patient's record in Firestore (merging the data)
                    setDoc(doc(db, "patients", currentNhsNumber), rememberedData, { merge: true })
                      .then(() => {
                        alert("Your data has been saved");
                      })
                      .catch((error) => {
                        console.error("Error saving data:", error);
                      });
                  } else {
                    // If not logged in, behave as before: save the data to state and go to the register tab
                    setSavedPatientData(rememberedData);
                    setCalculationResult(null);
                    setTimeout(() => {
                      setIsRegistering(true);
                      setRegisterSource("rememberMe");
                    }, 100);
                  }
                }}                
              >
                Remember Me
              </Button>                          
              )}

            </Box>
          </Box>

          <Divider />

          <Box>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
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
