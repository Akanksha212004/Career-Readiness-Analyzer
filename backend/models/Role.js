const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true,
        trim: true 
    },
    category: { 
        type: String, 
        required: true,
        lowercase: true, // Automatic small letters mein convert karega
        enum: ['internship', 'job'] // Frontend se match karne ke liye small rakha hai
    }
});

module.exports = mongoose.model('Role', roleSchema);