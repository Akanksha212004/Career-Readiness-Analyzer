import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import ResumeUpload from '@/components/ResumeUpload';
import { useCareerStore } from '@/store/useCareerStore';
import { useState } from "react";
import { roles } from "@/lib/roles";
import { Sparkles, BarChart3, Shield } from 'lucide-react';

const features = [  
  {
    icon: Sparkles,
    title: 'AI-Powered Analysis',
    desc: 'NLP-based resume parsing with skill extraction',
  },
  {
    icon: BarChart3,
    title: 'Detailed Scores',
    desc: 'Section-wise breakdown with visual charts',
  },
  {
    icon: Shield,
    title: 'Explainable AI',
    desc: 'Understand exactly why your score is what it is',
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [type, setType] = useState<'internship' | 'job'>('internship');
  const [actualFile, setActualFile] = useState<File | null>(null);

  const {
    selectedRole,
    fileName,
    setRole,
    setFileName,
    setResult,
    startAnalysis,
    setError
  } = useCareerStore();

  const isLoggedIn = !!localStorage.getItem('token');

  const handleAnalyze = async () => {
    if (!isLoggedIn) {
      alert("Please login to analyze your resume");
      navigate('/login');
      return;
    }

    if (!selectedRole) return alert("Please select a role");
    if (!actualFile) return alert("Please upload a resume");

    const formData = new FormData();
    // ✅ Change 1: Match the backend field name 'resume'
    formData.append('resume', actualFile); 
    formData.append('role', selectedRole);

    startAnalysis();

    try {
      const token = localStorage.getItem('token');

      // ✅ Change 2: Correct the URL to match backend routing
      const res = await fetch('http://localhost:5000/api/resume/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      const data = await res.json();

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        alert("Session expired. Please login again.");
        navigate('/login');
        return;
      }

      if (!res.ok) throw new Error(data.error || "Upload failed");
      
      setResult(data.result);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            AI Career Readiness
            <span className="text-primary"> Analyzer</span>
          </h1>

          <p className="mt-3 text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            Upload your resume, get instant AI analysis with readiness scores,
            skill gap detection, and personalized recommendations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="rounded-xl border bg-card p-4 text-center card-shadow"
              >
                <div className="flex justify-center mb-2">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold">{f.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </div>
            );
          })}
        </div>

        <ResumeUpload
          fileName={fileName}
          onFileSelect={(file) => {
            setActualFile(file);
            setFileName(file.name);
          }}
          onFileRemove={() => {
            setActualFile(null);
            setFileName(null);
          }}
        />

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setType('internship')}
            className={`px-4 py-2 rounded-lg transition-colors ${type === 'internship'
              ? 'bg-primary text-white'
              : 'bg-muted hover:bg-muted/80'
              }`}
          >
            Internship
          </button>

          <button
            onClick={() => setType('job')}
            className={`px-4 py-2 rounded-lg transition-colors ${type === 'job'
              ? 'bg-primary text-white'
              : 'bg-muted hover:bg-muted/80'
              }`}
          >
            Job
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Select Target Role</p>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {roles[type].map((role) => (
              <div
                key={role}
                onClick={() => setRole(role)}
                className={`min-w-[180px] text-center px-4 py-3 rounded-xl border cursor-pointer transition-all ${selectedRole === role
                  ? 'bg-primary text-white border-primary shadow-md'
                  : 'bg-card hover:border-primary/50 hover:bg-primary/5'
                  }`}
              >
                {role}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          className="mt-6 w-full px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-lg active:scale-[0.98]"
        >
          {isLoggedIn ? "Analyze Resume →" : "Login to Analyze"}
        </button>
      </main>
    </div>
  );
};

export default Index;