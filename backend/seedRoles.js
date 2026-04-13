const mongoose = require('mongoose');
const Role = require('./models/Role');
const fs = require('fs');
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
    await mongoose.connect(process.env.MONGO_URI);
    
    await Role.deleteMany({}); 
    console.log("Old roles cleared...");

    const rawData = fs.readFileSync('./roles_dataset.json');
    const rolesData = JSON.parse(rawData);

    await Role.insertMany(rolesData);
    console.log(`${rolesData.length} unique roles seeded successfully! `);
    
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

runSeed();