const mongoose = require('mongoose');
const Role = require('./models/Role');
require('dotenv').config();

const rolesData = [
  { title: "Full Stack Web Developer Intern", category: "internship" },
  { title: "Frontend React Intern", category: "internship" },
  { title: "Backend Node.js Intern", category: "internship" },
  { title: "Python Developer Intern", category: "internship" },
  { title: "Data Science Intern", category: "internship" },
  { title: "Software Development Engineer (SDE)", category: "job" },
  { title: "MERN Stack Developer", category: "job" },
  { title: "DevOps Engineer", category: "job" },
  { title: "Java Backend Engineer", category: "job" }
];

const runSeed = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/career_readiness';
    await mongoose.connect(uri);
    console.log("Database connected...");

    // Purana data saaf karein taaki fresh start ho
    await Role.deleteMany({}); 
    
    // Naya data insert karein
    await Role.insertMany(rolesData);

    console.log("Database Seeded Successfully! ");
    process.exit();
  } catch (err) {
    console.error("Seeding failed:", err.message);
    process.exit(1);
  }
};

runSeed();