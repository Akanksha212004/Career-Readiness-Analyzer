import { create } from 'zustand';

export interface SkillData {
  name: string;
  level: number;
}

export interface CourseData {
  title: string;
  platform: string;
  link: string;
  duration: string;
}

export interface JobData {
  role: string;
  company: string;
  location: string;
  applyLink: string;
}

export interface ScoreBreakdown {
  skills: number;
  projects: number;
  experience: number;
  education: number;
}

export interface ExplanationItem {
  area: string;
  issue: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
}

export interface AnalysisResult {
  overallScore: number;
  atsScore: number;
  skillMatch: number;
  breakdown: ScoreBreakdown;
  extractedSkills: string[];
  missingSkills: string[];
  recommendations: string[];
  suggestedProjects: string[];
  courses: CourseData[];
  jobs: JobData[];
  explanations: ExplanationItem[];
  confidenceLevel: number;
}

interface CareerStore {
  selectedRole: string;
  fileName: string | null;
  actualFile: File | null;
  isAnalyzing: boolean;
  result: AnalysisResult | null;
  error: string | null;
  setRole: (role: string) => void;
  setFileName: (name: string | null) => void;
  setActualFile: (file: File | null) => void;
  startAnalysis: () => void;
  setResult: (result: AnalysisResult) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useCareerStore = create<CareerStore>((set) => ({
  selectedRole: '',
  fileName: null,
  actualFile: null,
  isAnalyzing: false,
  result: null,
  error: null,
  setRole: (role) => set({ selectedRole: role }),
  setFileName: (name) => set({ fileName: name }),
  setActualFile: (file) => set({ actualFile: file }),
  startAnalysis: () => set({ isAnalyzing: true, error: null }),
  setResult: (result) => set({ result, isAnalyzing: false }),
  setError: (error) => set({ error, isAnalyzing: false }),
  reset: () => set({ selectedRole: '', fileName: null, actualFile: null, isAnalyzing: false, result: null, error: null }),
}));