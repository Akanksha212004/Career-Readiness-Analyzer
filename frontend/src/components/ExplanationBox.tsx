import { motion } from 'framer-motion';
import { AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { ExplanationItem } from '@/store/useCareerStore';

interface ExplanationBoxProps {
  explanations: ExplanationItem[];
}

const severityConfig = {
  high: { icon: AlertTriangle, bg: 'bg-destructive/5', border: 'border-destructive/20', iconColor: 'text-destructive', label: 'Critical' },
  medium: { icon: Info, bg: 'bg-accent/5', border: 'border-accent/20', iconColor: 'text-accent', label: 'Important' },
  low: { icon: Lightbulb, bg: 'bg-primary/5', border: 'border-primary/20', iconColor: 'text-primary', label: 'Tip' },
};

const ExplanationBox = ({ explanations }: ExplanationBoxProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.5 }}
    className="rounded-2xl bg-card p-6 card-shadow ring-1 ring-border"
  >
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-hero">
        <Lightbulb className="h-4 w-4 text-primary-foreground" />
      </div>
      <h3 className="font-heading text-lg font-semibold text-foreground">Why This Score?</h3>
      <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
        Explainable AI
      </span>
    </div>
    <div className="space-y-3">
      {explanations.map((item, i) => {
        const config = severityConfig[item.severity];
        const Icon = config.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.1 }}
            className={`rounded-xl border ${config.border} ${config.bg} p-4`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconColor}`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{item.area}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.iconColor}`}>
                    {config.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-foreground/80">{item.issue}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  <span className="font-medium text-primary">→</span> {item.suggestion}
                </p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  </motion.div>
);

export default ExplanationBox;
