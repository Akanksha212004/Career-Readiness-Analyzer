"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UploadCloud, FileText, X, Building2 } from "lucide-react";

import { fetchRoles, fetchPublicPostings, analyzeResume, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RoleLevelSelector } from "@/components/role-level-selector";
import { ResumeScanningIndicator } from "@/components/resume-scanning-indicator";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = [".pdf", ".docx"];

const roleSchema = z.object({
  mode: z.literal("role"),
  roleId: z.string().min(1, "Please select a target role."),
});

const jdSchema = z.object({
  mode: z.literal("jd"),
  jobDescription: z.string().min(50, "Paste the full job description (at least 50 characters)."),
});

const postingSchema = z.object({
  mode: z.literal("posting"),
  postingId: z.string().min(1, "Please select a posting to apply to."),
});

const formSchema = z.discriminatedUnion("mode", [roleSchema, jdSchema, postingSchema]);
type FormValues = z.infer<typeof formSchema>;

export function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { mode: "role", roleId: "" },
  });

  const mode = useWatch({ control, name: "mode" });

  const { data: postings, isLoading: postingsLoading } = useQuery({
    queryKey: ["postings", "public"],
    queryFn: fetchPublicPostings,
    enabled: mode === "posting",
  });

  const mutation = useMutation({
    mutationFn: analyzeResume,
    onSuccess: (result) => {
      router.push(`/dashboard/${result.id}`);
    },
  });

  function handleFileSelect(selected: File | null) {
    setFileError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const ext = selected.name.slice(selected.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      setFileError("Only PDF and DOCX files are supported.");
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFileError("File is too large. Max size is 5MB.");
      return;
    }
    setFile(selected);
  }

  function onSubmit(values: FormValues) {
    if (!file) {
      setFileError("Please upload your resume.");
      return;
    }
    mutation.mutate({
      file,
      roleId: values.mode === "role" ? values.roleId : undefined,
      jobDescription: values.mode === "jd" ? values.jobDescription : undefined,
      postingId: values.mode === "posting" ? values.postingId : undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* Resume upload */}
      <div className="flex flex-col gap-2">
        <Label>Your resume</Label>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileSelect(e.dataTransfer.files?.[0] ?? null);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface px-6 py-10 text-center transition-colors hover:border-primary/50"
        >
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 shadow-sm">
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-foreground/40 hover:text-error">{file.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileSelect(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-foreground/40 hover:text-error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <UploadCloud className="h-8 w-8 text-primary/60" />
              <p className="text-sm text-foreground/70">
                <span className="font-medium text-primary">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-foreground/40">PDF or DOCX, up to 5MB</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          />
        </div>
        {fileError && <p className="text-sm text-error">{fileError}</p>}
      </div>

      {/* Role vs JD vs Posting mode */}
      <div className="flex flex-col gap-2">
        <Label>Compare against</Label>
        <Tabs value={mode} onValueChange={(v) => setValue("mode", v as "role" | "jd" | "posting")}>
          <TabsList>
            <TabsTrigger value="role">A role type</TabsTrigger>
            <TabsTrigger value="jd">A specific job description</TabsTrigger>
            <TabsTrigger value="posting">Apply to a company posting</TabsTrigger>
          </TabsList>

          <TabsContent value="role">
            <Controller
              name="roleId"
              control={control}
              render={({ field }) =>
                mode === "role" ? (
                  <RoleLevelSelector
                    roles={roles ?? []}
                    isLoading={rolesLoading}
                    selectedRoleId={field.value ?? ""}
                    onSelect={field.onChange}
                  />
                ) : (
                  <></>
                )
              }
            />
            {mode === "role" && errors && "roleId" in errors && (
              <p className="mt-1.5 text-sm text-error">{errors.roleId?.message as string}</p>
            )}
          </TabsContent>

          <TabsContent value="jd">
            <Controller
              name="jobDescription"
              control={control}
              render={({ field }) =>
                mode === "jd" ? (
                  <Textarea
                    {...field}
                    placeholder="Paste the full job description here..."
                    className="min-h-40"
                  />
                ) : (
                  <></>
                )
              }
            />
            {mode === "jd" && errors && "jobDescription" in errors && (
              <p className="mt-1.5 text-sm text-error">{errors.jobDescription?.message as string}</p>
            )}
          </TabsContent>

          <TabsContent value="posting">
            <Controller
              name="postingId"
              control={control}
              render={({ field }) =>
                mode === "posting" ? (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={postingsLoading ? "Loading open postings..." : "Select a posting..."}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(postings ?? []).map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.title}
                          {p.companyId ? ` — ${p.companyId.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <></>
                )
              }
            />
            {mode === "posting" && !postingsLoading && (postings ?? []).length === 0 && (
              <p className="mt-1.5 text-sm text-foreground/50">No open postings right now. Check back later.</p>
            )}
            {mode === "posting" && errors && "postingId" in errors && (
              <p className="mt-1.5 text-sm text-error">{errors.postingId?.message as string}</p>
            )}
            {mode === "posting" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground/50">
                <Building2 className="h-3.5 w-3.5" />
                Analyzing here also submits your resume as an application to this posting&apos;s company.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {mutation.isPending && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 pt-5 text-sm text-foreground/70">
            <ResumeScanningIndicator size="md" />
            Scanning your resume for skills, ATS issues, and suggestions...
          </CardContent>
        </Card>
      )}

      {mutation.isError && (
        <Card className="border-error/30 bg-error/5">
          <CardContent className="pt-5 text-sm text-error">
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : "Something went wrong while analyzing your resume. Please try again."}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={mutation.isPending} className="self-start">
          {mutation.isPending ? (
            <>
              <ResumeScanningIndicator size="sm" /> Analyzing your resume...
            </>
          ) : mode === "posting" ? (
            "Analyze & apply"
          ) : (
            "Analyze my resume"
          )}
        </Button>
        {mode === "posting" && (
          <Badge variant="primary" className="gap-1">
            Applies on submit
          </Badge>
        )}
      </div>
    </form>
  );
}


