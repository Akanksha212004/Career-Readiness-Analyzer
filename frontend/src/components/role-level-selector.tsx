"use client";

import { useState } from "react";
import { Check, ChevronDown, Briefcase, GraduationCap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import type { RoleListItem } from "@/lib/types";

type RoleComboboxProps = {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  roles: RoleListItem[];
  isLoading: boolean;
  selectedRoleId: string;
  onSelect: (roleId: string) => void;
};

function RoleCombobox({ label, icon, placeholder, roles, isLoading, selectedRoleId, onSelect }: RoleComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedRole = roles.find((r) => r.role_id === selectedRoleId);

  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/50">
        {icon}
        {label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-11 w-full items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-2 text-sm transition-colors",
              "hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40",
              !selectedRole && "text-foreground/40"
            )}
          >
            <span className="truncate">{isLoading ? "Loading..." : selectedRole ? selectedRole.title : placeholder}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No matching roles found.</CommandEmpty>
              <CommandGroup>
                {roles.map((role) => (
                  <CommandItem
                    key={role.role_id}
                    value={role.title}
                    onSelect={() => {
                      onSelect(role.role_id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-4 w-4 shrink-0", role.role_id === selectedRoleId ? "opacity-100 text-primary" : "opacity-0")} />
                    {role.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function RoleLevelSelector({
  roles,
  isLoading,
  selectedRoleId,
  onSelect,
}: {
  roles: RoleListItem[];
  isLoading: boolean;
  selectedRoleId: string;
  onSelect: (roleId: string) => void;
}) {
  const internshipRoles = roles.filter((r) => r.level === "internship");
  const jobRoles = roles.filter((r) => r.level === "job");

  const selectedIsInternship = internshipRoles.some((r) => r.role_id === selectedRoleId);
  const selectedIsJob = jobRoles.some((r) => r.role_id === selectedRoleId);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <RoleCombobox
        label="Internship roles"
        icon={<GraduationCap className="h-3.5 w-3.5" />}
        placeholder="Search internship roles..."
        roles={internshipRoles}
        isLoading={isLoading}
        selectedRoleId={selectedIsInternship ? selectedRoleId : ""}
        onSelect={onSelect}
      />
      <RoleCombobox
        label="Entry-level job roles"
        icon={<Briefcase className="h-3.5 w-3.5" />}
        placeholder="Search entry-level job roles..."
        roles={jobRoles}
        isLoading={isLoading}
        selectedRoleId={selectedIsJob ? selectedRoleId : ""}
        onSelect={onSelect}
      />
    </div>
  );
}
