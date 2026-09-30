import { UploadForm } from "@/components/upload-form";
import { Card, CardContent } from "@/components/ui/card";
import { Target, ShieldCheck, TrendingUp, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Ambient gradient-blob background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-10 right-0 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-warning/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-14">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Role-matched resume scoring
          </span>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            How ready is your resume, really?
          </h1>
          <p className="mx-auto max-w-xl text-foreground/60">
            Upload your resume, tell us what you&apos;re aiming for, and get a readiness score, a clear
            skill-gap breakdown, and concrete next steps — not just a pass/fail.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureBlurb
            icon={<Target className="h-5 w-5" />}
            title="Role-matched scoring"
            description="Weighted across skills, projects, experience, and education."
          />
          <FeatureBlurb
            icon={<ShieldCheck className="h-5 w-5" />}
            title="ATS format check"
            description="Catches tables, images, and layouts that break real parsers."
          />
          <FeatureBlurb
            icon={<TrendingUp className="h-5 w-5" />}
            title="Track your progress"
            description="Every attempt is saved so you can watch your score climb."
          />
        </div>

        <Card>
          <CardContent className="p-6 sm:p-8">
            <UploadForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureBlurb({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface/80 p-4 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
        {icon}
      </span>
      <p className="font-heading text-sm font-semibold text-foreground">{title}</p>
      <p className="text-sm text-foreground/55">{description}</p>
    </div>
  );
}
