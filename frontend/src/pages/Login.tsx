import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  // State ko empty string se initialize kiya hai
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { email, password });
      
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userEmail', res.data.email);
      
      alert("Login Successful! Welcome back.");
      navigate('/'); 
      window.location.reload(); 
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Login failed. Please check your credentials.";
      alert(errorMsg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      {/* Form level par autoComplete off kiya hai */}
      <form onSubmit={handleLogin} autoComplete="off" className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg border border-gray-100">
        <h2 className="mb-6 text-2xl font-bold text-[#1a5f4a] text-center">CareerAI Login</h2>
        <div className="space-y-4">
          <input 
            type="email" 
            placeholder="Email Address" 
            required
            value={email} // ✅ State Binding
            autoComplete="new-password" // ✅ Autofill Block
            className="w-full rounded-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-[#248f6e]/50"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Password" 
            required
            value={password} // ✅ State Binding
            autoComplete="new-password" // ✅ Autofill Block
            className="w-full rounded-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-[#248f6e]/50"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="w-full rounded-lg bg-[#248f6e] py-3 font-semibold text-white hover:bg-[#1a5f4a] transition-all shadow-md">
            Sign In
          </button>
        </div>
        
        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link to="/register" className="text-[#248f6e] font-medium hover:underline">
            Register Here
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;