import React, { useState } from 'react';
import API from '../utils/api';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { data } = await API.post('/auth/login', formData);
            localStorage.setItem('token', data.token); // Save the token!
            alert("Login Successful!");
            window.location.href = '/'; // Redirect to home
        } catch (err) {
            alert("Login Failed: " + err.response.data.error);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <form onSubmit={handleSubmit} className="p-8 bg-white shadow-lg rounded-xl border border-gray-200 w-96">
                <h2 className="text-2xl font-bold text-[#1a5f4a] mb-6 text-center">CareerAI Login</h2>
                <input 
                    type="email" placeholder="Email" 
                    className="w-full p-2 mb-4 border rounded"
                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                />
                <input 
                    type="password" placeholder="Password" 
                    className="w-full p-2 mb-6 border rounded"
                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                />
                <button type="submit" className="w-full bg-[#248f6e] text-white p-2 rounded hover:bg-[#1a5f4a] transition">
                    Login
                </button>
            </form>
        </div>
    );
};

export default Login;