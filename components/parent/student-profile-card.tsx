"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2 } from "lucide-react";
import { updateStudentPhotoForParent } from "@/actions/parent";
import { useRouter } from "next/navigation";
import type { ParentStudentProfile } from "@/types";
import { PushNotificationToggle } from "@/components/notifications/push-toggle";


interface StudentProfileCardProps {
  profile: ParentStudentProfile;
}

export function StudentProfileCard({ profile }: StudentProfileCardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Upload
    startTransition(async () => {
      const formData = new FormData();
      formData.append("photo", file);
      const result = await updateStudentPhotoForParent(profile._id, formData);
      if (result.success) {
        toast.success("Photo updated successfully");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update photo");
        setPreviewUrl(null);
      }
    });
  };

  const photoSrc = previewUrl ?? profile.photo;

  const infoRows = [
    { label: "Name", value: profile.name },
    { label: "Class", value: `${profile.className} – Section ${profile.section}` },
    { label: "Roll No.", value: profile.rollNumber ?? "—" },
    { label: "Reg. No.", value: profile.registrationNumber || "—" },
    { label: "Gender", value: profile.gender ?? "—" },
    { label: "Date of Birth", value: profile.dateOfBirth || "—" },
    { label: "Date of Admission", value: profile.dateOfAdmission ?? "—" },
    { label: "Address", value: profile.address || "—" },
    { label: "Father's Name", value: profile.parents.father?.name ?? "—" },
    { label: "Mother's Name", value: profile.parents.mother?.name ?? "—" },
    { label: "Mobile", value: profile.contacts.mobile.join(", ") || "—" },
    { label: "Email", value: profile.contacts.email.join(", ") || "—" },
  ];

  return (
    <div className="space-y-6">
      {/* Identity Card style — passport photo + basic info */}
      <Card className="overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-primary to-primary/60" />
        <CardContent className="pt-0 relative">
          <div className="flex gap-5 -mt-8 mb-4">
            {/* Passport-size photo (3:4 aspect ratio) */}
            <div className="relative group flex-shrink-0">
              <div
                className="relative overflow-hidden rounded-md border-4 border-background shadow-md ring-1 ring-black/10"
                style={{ width: 80, height: 107 }} // 3:4 passport ratio
              >
                {photoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoSrc}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Avatar className="w-full h-full rounded-none">
                    <AvatarFallback className="rounded-none text-2xl bg-primary/10 text-primary">
                      {profile.name[0]}
                    </AvatarFallback>
                  </Avatar>
                )}

                {/* Upload overlay */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending}
                  className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mb-0.5" />
                      <span className="text-[9px] font-medium">Update</span>
                    </>
                  )}
                </button>
              </div>

              {/* Floating edit button for mobile/better visibility */}
              <Button
                variant="secondary"
                size="icon"
                className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border shadow-sm flex items-center justify-center bg-background p-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin"/> : <Camera className="h-3 w-3" />}
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            <div className="pt-2 sm:pt-4 flex-1">
              <h2 className="text-xl font-bold">{profile.name}</h2>
              <p className="text-sm text-muted-foreground">
                {profile.className} · Section {profile.section}
              </p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">
                  #{profile.registrationNumber || "N/A"}
                </Badge>
                <Badge variant={profile.isActive ? "default" : "destructive"} className="text-[10px]">
                  {profile.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-base flex items-center justify-between font-bold">
            Notification Settings
            <Badge variant="outline" className="text-[10px] bg-white font-normal border-primary/20">Real-time alerts</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <PushNotificationToggle
            userId={profile._id}
            role="parent"
            initialEnabled={profile.notificationSettings?.pushEnabled ?? false}
          />
        </CardContent>
      </Card>

      {/* Details table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Student Details</CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          <dl className="divide-y">
            {infoRows.map((row) => (
              <div key={row.label} className="flex justify-between py-2.5 gap-4 text-sm">
                <dt className="text-muted-foreground font-medium flex-shrink-0 w-36">{row.label}</dt>
                <dd className="text-right break-all">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
