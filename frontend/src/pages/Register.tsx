import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, ArrowRight } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords do not match" });
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/auth/register', { email, password });
      
      toast({ 
        title: "Registration Successful!", 
        description: "Account created! Redirecting to login..." 
      });
      
      setTimeout(() => navigate('/login'), 1500); 
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Registration Failed", 
        description: err.response?.data?.error || "User might already exist or server is down." 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl border border-gray-100">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#248f6e]/10">
            <UserPlus className="h-6 w-6 text-[#248f6e]" />
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">Create Account</h2>
          <p className="mt-2 text-sm text-gray-600">Join CareerAI to analyze your readiness</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleRegister} autoComplete="off">
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="email"
                required
                value={email} // ✅ State Binding
                autoComplete="new-password" // ✅ Autofill Block
                className="block w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-gray-900 focus:border-[#248f6e] focus:ring-[#248f6e] sm:text-sm"
                placeholder="Email address"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="password"
                required
                value={password} // ✅ State Binding
                autoComplete="new-password" // ✅ Autofill Block
                className="block w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-gray-900 focus:border-[#248f6e] focus:ring-[#248f6e] sm:text-sm"
                placeholder="Password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="password"
                required
                value={confirmPassword} // ✅ State Binding
                autoComplete="new-password" // ✅ Autofill Block
                className="block w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-gray-900 focus:border-[#248f6e] focus:ring-[#248f6e] sm:text-sm"
                placeholder="Confirm Password"
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-lg bg-[#248f6e] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1a5f4a] focus:outline-none focus:ring-2 focus:ring-[#248f6e] transition-all disabled:opacity-50 shadow-md"
          >
            {loading ? "Creating account..." : "Sign Up"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>

          <div className="text-center text-sm">
            <p className="text-gray-600">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-[#248f6e] hover:underline">
                Log in here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;