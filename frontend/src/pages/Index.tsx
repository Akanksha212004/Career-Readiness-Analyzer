import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import ResumeUpload from '@/components/ResumeUpload';
import { useCareerStore } from '@/store/useCareerStore';
import { useState, useEffect } from "react";
import { Sparkles, BarChart3, Shield } from 'lucide-react';
// @ts-ignore
import API from '@/utils/api';

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
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const {
    selectedRole,
    fileName,
    actualFile,
    setRole,
    setFileName,
    setActualFile,
    setResult,
    startAnalysis,
    setError
  } = useCareerStore();

  const isLoggedIn = !!localStorage.getItem('token');

  useEffect(() => {
    const fetchRoles = async () => {
      if (searchQuery.trim().length > 1) {
        try {
          const res = await API.get(`/resume/roles/search?q=${searchQuery}&type=${type}`);
          setSuggestions(res.data);
          setShowSuggestions(true);
        } catch (err) {
          console.error("Error fetching roles:", err);
        }
      } else {
        setSuggestions([]);
      }
    };

    const timer = setTimeout(fetchRoles, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, type]);

  const handleAnalyze = async () => {
    // Merge Logic: Dono ke inputs ko handle karne ke liye
    const finalRole = selectedRole || searchQuery;

    // Validation checks
    if (!finalRole.trim()) return alert("Please select or type a role");
    if (!actualFile) return alert("Please upload a resume");

    const formData = new FormData();
    formData.append('resume', actualFile); 
    formData.append('role', finalRole);
    formData.append('type', type);

    startAnalysis();

    try {
      const token = localStorage.getItem('token');
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
              <div key={i} className="rounded-xl border bg-card p-4 text-center card-shadow">
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
          onFileSelectError={(err) => setError(err)}
          onFileRemove={() => {
            setActualFile(null);
            setFileName(null);
          }}
        />

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
                setType('internship');
                setSearchQuery(""); 
                setRole(""); 
            }}
            className={`px-4 py-2 rounded-lg transition-colors ${type === 'internship' ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'}`}
          >
            Internship
          </button>
          <button
            onClick={() => {
                setType('job');
                setSearchQuery("");
                setRole("");
            }}
            className={`px-4 py-2 rounded-lg transition-colors ${type === 'job' ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'}`}
          >
            Job
          </button>
        </div>

        <div className="mt-4 relative">
          <p className="mb-2 text-sm font-medium">Search & Select Target Role</p>
          <input
            type="text"
            placeholder={`Type to search ${type} roles...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full p-3 rounded-xl border bg-card focus:ring-2 focus:ring-primary outline-none transition-all"
          />

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-card border rounded-xl shadow-2xl max-h-60 overflow-y-auto">
              {suggestions.map((role) => (
                <div
                  key={role._id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setRole(role.title);
                    setSearchQuery(role.title);
                    setShowSuggestions(false);
                  }}
                  className="px-4 py-3 hover:bg-primary/10 cursor-pointer border-b last:border-none"
                >
                  {role.title}
                </div>
              ))}
            </div>
          )}

          {selectedRole && (
            <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Active Selection:</span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-bold">
                    {selectedRole}
                </span>
            </div>
          )}
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