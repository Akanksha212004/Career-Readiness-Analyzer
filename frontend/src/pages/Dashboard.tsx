import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, FileCheck, Percent, ArrowLeft, Rocket, CheckCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import ScoreCard from '@/components/ScoreCard';
import ChartCard from '@/components/ChartCard';
import SkillBadge from '@/components/SkillBadge';
import CourseCard from '@/components/CourseCard';
import JobCard from '@/components/JobCard';
import ExplanationBox from '@/components/ExplanationBox';
import Loader from '@/components/Loader';
import { useCareerStore } from '@/store/useCareerStore';
import ChatBot from '../components/ChatBot';


const Dashboard = () => {
  const navigate = useNavigate();
  const { result, isAnalyzing, selectedRole } = useCareerStore();

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <Loader />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <p className="text-muted-foreground">No analysis results yet.</p>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Upload Resume
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Analysis Results</h1>
            <p className="text-sm text-muted-foreground">
              Target Role: <span className="font-medium text-primary">{selectedRole}</span>
              {' · '}
              Confidence: <span className="font-medium">{result.confidenceLevel}%</span>
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> New Analysis
          </button>
        </motion.div>

        {/* Score Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <ScoreCard label="Overall Readiness" score={result.overallScore} icon={<Target className="h-6 w-6 text-primary" />} delay={0} />
          <ScoreCard label="ATS Score" score={result.atsScore} icon={<FileCheck className="h-6 w-6 text-accent" />} delay={0.1} />
          <ScoreCard label="Skill Match" score={result.skillMatch} icon={<Percent className="h-6 w-6 text-primary" />} delay={0.2} />
        </div>

        {/* Charts */}
        <div className="mb-8">
          <ChartCard breakdown={result.breakdown} />
        </div>

        {/* Explainable AI */}
        <div className="mb-8">
          <ExplanationBox explanations={result.explanations} />
        </div>

        {/* Skills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8 grid gap-6 md:grid-cols-2"
        >
          <div className="rounded-2xl bg-card p-6 card-shadow ring-1 ring-border">
            <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
              <CheckCircle className="h-5 w-5 text-success" /> Extracted Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.extractedSkills.map((skill, i) => (
                <SkillBadge key={skill} skill={skill} variant="present" index={i} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-card p-6 card-shadow ring-1 ring-border">
            <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
              <Target className="h-5 w-5 text-destructive" /> Missing Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.missingSkills.map((skill, i) => (
                <SkillBadge key={skill} skill={skill} variant="missing" index={i} />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Recommendations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mb-8 rounded-2xl bg-card p-6 card-shadow ring-1 ring-border"
        >
          <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <Rocket className="h-5 w-5 text-primary" /> Recommendations
          </h3>
          <ul className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {rec}
              </li>
            ))}
          </ul>
          {result.suggestedProjects.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-sm font-medium text-muted-foreground">Suggested Projects</p>
              <ul className="space-y-1">
                {result.suggestedProjects.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>

        {/* Courses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <h3 className="mb-4 font-heading text-lg font-semibold text-foreground">🎓 Recommended Courses</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {result.courses.map((course, i) => (
              <CourseCard key={i} course={course} index={i} />
            ))}
          </div>
        </motion.div>

        {/* Jobs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mb-12"
        >
          <h3 className="mb-4 font-heading text-lg font-semibold text-foreground">💼 Job Opportunities</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.jobs.map((job, i) => (
              <JobCard key={i} job={job} index={i} />
            ))}
          </div>
        </motion.div>
      </main>

      <ChatBot />

    </div>
  );
};

export default Dashboard;
