"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Building2 } from "lucide-react";

import { useAuth } from "@/lib/auth-provider";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const schema = z.object({
  name: z.string().min(1, "Your name is required."),
  email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  companyName: z.string().min(1, "Company name is required."),
  companyDomain: z
    .string()
    .min(1, "Company domain is required.")
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a domain like acme.com."),
});
type FormValues = z.infer<typeof schema>;

export default function CompanySignupPage() {
  const router = useRouter();
  const { signupCompany } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", companyName: "", companyDomain: "" },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await signupCompany(values);
      router.push("/admin");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col items-center justify-center px-6 py-14">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
        <Building2 className="h-5 w-5" />
      </span>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Register your company</CardTitle>
          <CardDescription>
            Create a company workspace to post openings and review candidates. A super admin reviews and approves
            new companies before postings go live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="companyName">Company name</Label>
                <Input id="companyName" placeholder="Acme Inc." {...register("companyName")} />
                {errors.companyName && <p className="text-sm text-error">{errors.companyName.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="companyDomain">Company domain</Label>
                <Input id="companyDomain" placeholder="acme.com" {...register("companyDomain")} />
                {errors.companyDomain && <p className="text-sm text-error">{errors.companyDomain.message}</p>}
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" autoComplete="name" placeholder="Jane Doe" {...register("name")} />
              {errors.name && <p className="text-sm text-error">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="jane@acme.com" {...register("email")} />
              {errors.email && <p className="text-sm text-error">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                {...register("password")}
              />
              {errors.password && <p className="text-sm text-error">{errors.password.message}</p>}
            </div>

            {serverError && <p className="text-sm text-error">{serverError}</p>}

            <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating company...
                </>
              ) : (
                "Register company"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-5 text-sm text-foreground/60">
        Just looking for a job?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up as a candidate
        </Link>
      </p>
    </div>
  );
}

