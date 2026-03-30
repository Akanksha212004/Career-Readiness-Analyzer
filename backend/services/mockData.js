/**
 * Fallback mock results matching the frontend mockData.ts exactly.
 * Used when the ML API is unreachable or during development.
 */
const mockResults = {
  'Frontend Intern': {
    overallScore: 68,
    atsScore: 72,
    skillMatch: 65,
    breakdown: { skills: 70, projects: 60, experience: 55, education: 80 },
    extractedSkills: ['HTML', 'CSS', 'JavaScript', 'React', 'Git', 'Responsive Design'],
    missingSkills: ['TypeScript', 'Testing (Jest)', 'Next.js', 'CI/CD', 'Figma', 'Redux'],
    recommendations: [
      'Learn TypeScript to stand out from other candidates',
      'Add unit testing skills with Jest & React Testing Library',
      'Build a portfolio website showcasing 3-5 projects',
    ],
    suggestedProjects: [
      'E-commerce dashboard with React + TypeScript',
      'Weather app with API integration',
      'Portfolio website with animations',
    ],
    courses: [
      { title: 'React - The Complete Guide', platform: 'Udemy', link: 'https://udemy.com', duration: '40 hours' },
      { title: 'TypeScript for Professionals', platform: 'Frontend Masters', link: 'https://frontendmasters.com', duration: '12 hours' },
      { title: 'Testing JavaScript', platform: 'Testing JavaScript', link: 'https://testingjavascript.com', duration: '8 hours' },
      { title: 'CSS for JavaScript Developers', platform: 'Josh Comeau', link: 'https://css-for-js.dev', duration: '20 hours' },
    ],
    jobs: [
      { role: 'Frontend Intern', company: 'Google', location: 'Remote', applyLink: 'https://careers.google.com' },
      { role: 'React Developer Intern', company: 'Meta', location: 'Menlo Park, CA', applyLink: 'https://metacareers.com' },
      { role: 'UI Engineer Intern', company: 'Stripe', location: 'San Francisco, CA', applyLink: 'https://stripe.com/jobs' },
    ],
    explanations: [
      { area: 'Skills', issue: 'Missing TypeScript which 85% of frontend roles require', suggestion: 'Complete a TypeScript course and convert one project to TS', severity: 'high' },
      { area: 'Projects', issue: 'No deployed projects found on resume', suggestion: 'Deploy at least 2 projects on Vercel or Netlify with live links', severity: 'high' },
      { area: 'Experience', issue: 'No internship or freelance experience listed', suggestion: 'Contribute to open source or take freelance projects on Upwork', severity: 'medium' },
      { area: 'Testing', issue: 'No testing skills mentioned', suggestion: 'Learn Jest and write tests for your existing projects', severity: 'medium' },
    ],
    confidenceLevel: 87,
  },

  'Backend Intern': {
    overallScore: 55,
    atsScore: 60,
    skillMatch: 50,
    breakdown: { skills: 55, projects: 45, experience: 40, education: 75 },
    extractedSkills: ['Python', 'SQL', 'Git', 'REST APIs'],
    missingSkills: ['Node.js', 'Docker', 'AWS', 'Redis', 'GraphQL', 'System Design'],
    recommendations: [
      'Learn Docker and containerization basics',
      'Build REST APIs with authentication',
      'Study system design fundamentals',
    ],
    suggestedProjects: [
      'REST API with JWT authentication',
      'URL shortener with Redis caching',
      'Microservices architecture demo',
    ],
    courses: [
      { title: 'Node.js - The Complete Guide', platform: 'Udemy', link: 'https://udemy.com', duration: '35 hours' },
      { title: 'Docker & Kubernetes', platform: 'Coursera', link: 'https://coursera.org', duration: '25 hours' },
      { title: 'System Design Primer', platform: 'Educative', link: 'https://educative.io', duration: '15 hours' },
      { title: 'PostgreSQL for Beginners', platform: 'Udemy', link: 'https://udemy.com', duration: '10 hours' },
    ],
    jobs: [
      { role: 'Backend Intern', company: 'Amazon', location: 'Seattle, WA', applyLink: 'https://amazon.jobs' },
      { role: 'API Developer Intern', company: 'Twilio', location: 'Remote', applyLink: 'https://twilio.com/careers' },
      { role: 'Software Engineer Intern', company: 'Cloudflare', location: 'Austin, TX', applyLink: 'https://cloudflare.com/careers' },
    ],
    explanations: [
      { area: 'Skills', issue: 'Missing containerization skills (Docker)', suggestion: 'Learn Docker basics and containerize one project', severity: 'high' },
      { area: 'Projects', issue: 'Projects lack production-level features', suggestion: 'Add authentication, error handling, and logging', severity: 'high' },
      { area: 'Experience', issue: 'No backend-specific experience', suggestion: 'Build and deploy a production API', severity: 'medium' },
    ],
    confidenceLevel: 82,
  },

  'ML Engineer': {
    overallScore: 45,
    atsScore: 50,
    skillMatch: 40,
    breakdown: { skills: 45, projects: 35, experience: 30, education: 70 },
    extractedSkills: ['Python', 'NumPy', 'Pandas', 'Basic ML'],
    missingSkills: ['TensorFlow', 'PyTorch', 'MLOps', 'Deep Learning', 'NLP', 'Computer Vision', 'AWS SageMaker'],
    recommendations: [
      'Master deep learning with TensorFlow or PyTorch',
      'Build end-to-end ML pipelines',
      'Publish research or blog about ML projects',
    ],
    suggestedProjects: [
      'Image classification with CNN',
      'Sentiment analysis NLP pipeline',
      'ML model deployment with FastAPI',
    ],
    courses: [
      { title: 'Deep Learning Specialization', platform: 'Coursera', link: 'https://coursera.org', duration: '60 hours' },
      { title: 'Fast.ai Practical Deep Learning', platform: 'fast.ai', link: 'https://fast.ai', duration: '30 hours' },
      { title: 'MLOps Fundamentals', platform: 'Google Cloud', link: 'https://cloud.google.com/training', duration: '20 hours' },
      { title: 'Kaggle ML Courses', platform: 'Kaggle', link: 'https://kaggle.com/learn', duration: '15 hours' },
    ],
    jobs: [
      { role: 'ML Engineer Intern', company: 'OpenAI', location: 'San Francisco, CA', applyLink: 'https://openai.com/careers' },
      { role: 'Data Science Intern', company: 'Netflix', location: 'Remote', applyLink: 'https://jobs.netflix.com' },
      { role: 'AI Research Intern', company: 'DeepMind', location: 'London, UK', applyLink: 'https://deepmind.com/careers' },
    ],
    explanations: [
      { area: 'Skills', issue: 'No deep learning framework experience', suggestion: 'Complete a PyTorch or TensorFlow course with projects', severity: 'high' },
      { area: 'Projects', issue: 'No ML projects with real-world datasets', suggestion: 'Participate in Kaggle competitions', severity: 'high' },
      { area: 'MLOps', issue: 'No model deployment experience', suggestion: 'Deploy a model using FastAPI and Docker', severity: 'high' },
      { area: 'Research', issue: 'No publications or technical writing', suggestion: 'Write blog posts about your ML experiments', severity: 'low' },
    ],
    confidenceLevel: 79,
  },
};

function getMockResultByRole(role) {
  if (mockResults[role]) return mockResults[role];
  if (role.includes('Frontend') || role.includes('React')) return mockResults['Frontend Intern'];
  if (role.includes('Backend') || role.includes('Node'))   return mockResults['Backend Intern'];
  if (role.includes('ML') || role.includes('Data'))        return mockResults['ML Engineer'];
  return mockResults['Frontend Intern'];
}

module.exports = { getMockResultByRole };
