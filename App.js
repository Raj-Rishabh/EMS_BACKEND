const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT;

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// MongoDB Connectionrs

// const dbURI = 'mongodb://localhost:27017/employeeDB';


const dbURL=process.env.ATLASDB_URL;
mongoose.connect(dbURL)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// Define Models
const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i;

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, match: emailRegex },
  mobileNo: { type: String, required: true, unique: true, match: /^\d{10}$/ },
  designation: { type: String, required: true },
  gender: { type: String, required: true, enum: ['Male', 'Female'] },
  course: { type: Array, required: true },
  createDate: { type: Date, default: Date.now },
  imgUpload: { type: String, required: true }
});

employeeSchema.index({ name: 'text', _id: 'text'});

const userSchema = new mongoose.Schema({
  userName: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
});

const Employee = mongoose.model('Employee', employeeSchema);
const User = mongoose.model('User', userSchema);

// Validation Function
const validateEmployeeData = (data) => {
  const { name, email, mobileNo, imgUpload } = data;

  if (!name || !email || !mobileNo || !imgUpload) {
    return 'Name, Email, Mobile No, and Image Upload are required.';
  }

  if (!emailRegex.test(email)) {
    return 'Invalid email format.';
  }

  if (!/^\d{10}$/.test(mobileNo)) {
    return 'Mobile No must be a 10-digit number.';
  }

  return null;
};

// Function to Handle Duplicate Field Errors
const handleDuplicateFieldError = (error) => {
  if (error.code === 11000) {
    if (error.keyPattern && error.keyPattern.email) {
      return 'Duplicate email entered.';
    } else if (error.keyPattern && error.keyPattern.mobileNo) {
      return 'Duplicate mobile number entered.';
    } else {
      return 'Duplicate field value entered.';
    }
  }
  return 'Failed to process request.';
};

// API Endpoints
app.get('/employees', async (req, res) => {
  const query = req.query;
  const searchQuery = query.search ? { $text: { $search: query.search } } : undefined
  const sortField = query.field || 'createDate';
  try {
    const employees = await Employee.find(searchQuery).sort({ [sortField]: 1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

app.get('/employees/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

app.post('/employees', async (req, res) => {
  const validationError = validateEmployeeData(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const newEmployee = new Employee(req.body);
    await newEmployee.save();
    res.status(201).json(newEmployee);
  } catch (error) {
    console.log(error);
    const duplicateFieldError = handleDuplicateFieldError(error);
    res.status(400).json({ error: duplicateFieldError });
  }
});

app.put('/employees/:id', async (req, res) => {
  const validationError = validateEmployeeData(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const updateData = req.body;
    const updatedEmployee = await Employee.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updatedEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(updatedEmployee);
  } catch (error) {
    console.log(error);
    const duplicateFieldError = handleDuplicateFieldError(error);
    res.status(400).json({ error: duplicateFieldError });
  }
});

app.delete('/employees/:id', async (req, res) => {
  try {
    const deletedEmployee = await Employee.findByIdAndDelete(req.params.id);
    if (!deletedEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

app.post('/signUp', async (req, res) => {
  console.log(req.body);
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: 'Failed to create user' });
  }
});

app.post('/login', async (req, res) => {
  const { userName, password } = req.body;
  try {
    const user = await User.findOne({ userName });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const isMatch = password === user.password;
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    res.json({ message: 'Login successful', userId: user._id, name: user.name });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
