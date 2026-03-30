import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';

const steps = [
  'Parsing resume...',
  'Extracting skills...',
  'Analyzing experience...',
  'Calculating scores...',
  'Generating recommendations...',
];

const Loader = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
      className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-hero"
    >
      <Brain className="h-8 w-8 text-primary-foreground" />
    </motion.div>
    <div className="space-y-2 text-center">
      <h3 className="font-heading text-lg font-semibold text-foreground">Analyzing Your Resume</h3>
      <div className="space-y-1">
        {steps.map((step, i) => (
          <motion.p
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0.4] }}
            transition={{ delay: i * 0.6, duration: 2.4 }}
            className="text-sm text-muted-foreground"
          >
            {step}
          </motion.p>
        ))}
      </div>
    </div>
  </div>
);

export default Loader;
