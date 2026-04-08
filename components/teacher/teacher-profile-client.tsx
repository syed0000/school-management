"use client";

import { useState } from "react";
import { Teacher } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/ui/file-uploader-new";
import { toast } from "sonner";
import { updateTeacherProfilePhoto } from "@/actions/teacher-portal";
import { Loader2, Camera, Phone, Mail, IdCard, Wallet, BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PushNotificationToggle } from "@/components/notifications/push-toggle";
import { Settings as SettingsIcon } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";


export function TeacherProfileClient({ teacher }: { teacher: Teacher }) {
  const { t } = useI18n();
  const router = useRouter();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);

  const handleUpdatePhoto = async () => {
    if (!photoFile) return;
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append("photo", photoFile);
      
      const res = await updateTeacherProfilePhoto(formData);
      if (res.success) {
        toast.success(t("teacherProfile.toastPhotoUpdated", "Profile photo updated successfully"));
        setIsEditingPhoto(false);
        setPhotoFile(null);
        router.refresh();
      } else {
        toast.error(res.error || t("teacherProfile.toastPhotoUpdateFailed", "Failed to update photo"));
      }
    } catch {
      toast.error(t("teacherProfile.toastSomethingWentWrong", "Something went wrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("teacherProfile.title", "My Profile")}</h1>
      
      {/* Profile Header Card */}
      <Card className="overflow-hidden border-0 shadow-sm sm:border bg-linear-to-br from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative group">
              <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                <AvatarImage src={teacher.photo} alt={teacher.name} className="object-cover" />
                <AvatarFallback className="text-4xl bg-primary/10 text-primary">
                  {teacher.name?.charAt(0) || "T"}
                </AvatarFallback>
              </Avatar>
              <Button 
                size="icon" 
                variant="secondary" 
                className="absolute bottom-0 right-0 h-10 w-10 shrink-0 rounded-full shadow-md"
                onClick={() => setIsEditingPhoto(!isEditingPhoto)}
              >
                <Camera className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="flex-1 text-center sm:text-left space-y-1 mt-2">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h2 className="text-2xl font-bold">{teacher.name}</h2>
                <BadgeCheck className="h-5 w-5 text-blue-500 shrink-0" />
              </div>
              <p className="text-muted-foreground font-medium">Teacher ID: {teacher.teacherId}</p>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-3">
                <div className="flex items-center text-sm bg-background/60 px-3 py-1.5 rounded-full border">
                  <Phone className="mr-2 h-4 w-4 text-primary" />
                  {teacher.phone}
                </div>
                {teacher.email && (
                  <div className="flex items-center text-sm bg-background/60 px-3 py-1.5 rounded-full border">
                    <Mail className="mr-2 h-4 w-4 text-primary" />
                    {teacher.email}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {isEditingPhoto && (
            <div className="mt-6 p-4 bg-background rounded-xl border animate-in fade-in slide-in-from-top-4">
              <h3 className="text-sm font-semibold mb-3">{t("teacherProfile.updatePhotoTitle", "Update Profile Photo")}</h3>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex-1 w-full">
                  <FileUploader 
                    onFileSelect={(f) => setPhotoFile(f)} 
                    label={t("teacherProfile.chooseNewPhoto", "Choose new photo...")}
                    className="mt-0"
                    accept="image/*"
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button 
                    onClick={handleUpdatePhoto} 
                    disabled={!photoFile || loading}
                    className="flex-1 sm:flex-none"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("teacherProfile.savePhoto", "Save Photo")}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsEditingPhoto(false);
                    setPhotoFile(null);
                  }} className="flex-1 sm:flex-none">
                    {t("teacherProfile.cancel", "Cancel")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Details */}
        <Card className="border-0 shadow-sm sm:border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <IdCard className="mr-2 h-5 w-5 text-primary" />
              {t("teacherProfile.personalDetails", "Personal Details")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-muted-foreground">{t("teacherProfile.aadhaarNumber", "Aadhaar Number")}</span>
                <p className="font-medium">{teacher.aadhaar?.replace(/(\d{4})/g, '$1 ').trim() || "-"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">{t("teacherProfile.joiningDate", "Joining Date")}</span>
                <p className="font-medium">{teacher.joiningDate ? format(new Date(teacher.joiningDate), 'dd MMM yyyy') : "-"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">{t("teacherProfile.fatherName", "Father's Name")}</span>
                <p className="font-medium">{teacher.parents?.fatherName || "-"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">{t("teacherProfile.motherName", "Mother's Name")}</span>
                <p className="font-medium">{teacher.parents?.motherName || "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Professional Details */}
        <Card className="border-0 shadow-sm sm:border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Wallet className="mr-2 h-5 w-5 text-primary" />
              {t("teacherProfile.professionalInfo", "Professional Info")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-muted-foreground">{t("teacherProfile.govtTeacherId", "Govt. Teacher ID")}</span>
                <p className="font-medium">{teacher.governmentTeacherId || "-"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">{t("teacherProfile.pastExperience", "Past Experience")}</span>
                <p className="font-medium">
                  {teacher.pastExperience?.totalExperience || "0"} {t("teacherProfile.years", "Years")}
                </p>
              </div>
              <div className="space-y-1 col-span-2">
                <span className="text-muted-foreground">{t("teacherProfile.assignedClasses", "Assigned Classes")}</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {teacher.assignedClasses && teacher.assignedClasses.length > 0 ? (
                    (teacher.assignedClasses as unknown as Array<{ classId?: string | { name?: string }; section?: string }>).map((ac, i) => (
                      <span key={i} className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-md text-xs font-medium">
                        {(typeof ac.classId === "object" && ac.classId ? ac.classId.name : t("teacherProfile.classFallback", "Class"))} {ac.section}
                      </span>
                    ))
                  ) : <span className="font-medium text-muted-foreground">{t("teacherProfile.none", "None")}</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Settings */}
        <Card className="border-0 shadow-sm sm:border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <SettingsIcon className="mr-2 h-5 w-5 text-primary" />
              {t("teacherProfile.accountSettings", "Account Settings")}
            </CardTitle>
            <CardDescription>{t("teacherProfile.accountSubtitle", "Manage your app preferences")}</CardDescription>
          </CardHeader>
          <CardContent>
            <PushNotificationToggle
              userId={teacher._id}
              role="teacher"
              initialEnabled={teacher.notificationSettings?.pushEnabled ?? false}
            />
          </CardContent>
        </Card>

        {/* Placeholder or Help */}
        <div className="flex flex-col justify-center p-6 text-center text-sm text-muted-foreground border-2 border-dashed rounded-xl">
          <p>{t("teacherProfile.contactAdmins", "If you need to update profile details or salary info, please contact the administrators.")}</p>
        </div>
      </div>

    </div>
  );
}
