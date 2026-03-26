"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, Edit2 } from "lucide-react";
import { updateStudentPhotoForParent } from "@/actions/parent";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface DashboardPhotoUploadProps {
  profileId: string;
  name: string;
  photo?: string;
}

export function DashboardPhotoUpload({ profileId, name, photo }: DashboardPhotoUploadProps) {
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
      const result = await updateStudentPhotoForParent(profileId, formData);
      if (result.success) {
        toast.success("Photo updated successfully");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update photo");
        setPreviewUrl(null);
      }
    });
  };

  const photoSrc = previewUrl ?? photo;

  return (
    <div className="relative group flex-shrink-0">
      <Avatar className="h-20 w-20 border-4 border-background shadow-md ring-2 ring-primary/20">
        <AvatarImage 
          src={photoSrc || undefined} 
          className="object-cover" 
        />
        <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
          {name[0]}
        </AvatarFallback>
      </Avatar>

      {/* Modern upload overlay */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isPending}
        className="absolute inset-0 rounded-full bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer overflow-hidden"
        title="Change Photo"
      >
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Camera className="h-5 w-5 mb-0.5" />
            <span className="text-[10px] font-medium">Update</span>
          </>
        )}
      </button>

      {/* Floating small button for better visibility on mobile as well */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border shadow-sm sm:hidden flex items-center justify-center bg-background p-1"
        onClick={() => fileInputRef.current?.click()}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin"/> : <Edit2 className="h-3 w-3" />}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoChange}
      />
    </div>
  );
}
