import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useAvatarUpload() {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const compressAndResizeImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        // Redimensionar para 300x300px
        const targetSize = 300;
        canvas.width = targetSize;
        canvas.height = targetSize;

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Desenhar imagem redimensionada
        ctx.drawImage(img, 0, 0, targetSize, targetSize);

        // Comprimir como JPEG com qualidade 0.8
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          "image/jpeg",
          0.8
        );
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadAvatar = async (file: File, userId: string): Promise<string | null> => {
    setUploading(true);
    try {
      console.log("Starting avatar upload for user:", userId);
      
      // Comprimir e redimensionar imagem
      const compressedBlob = await compressAndResizeImage(file);
      console.log("Image compressed. Original:", file.size, "Compressed:", compressedBlob.size);

      // Nome do arquivo: {userId}/avatar.jpg
      const filePath = `${userId}/avatar.jpg`;

      // Deletar avatar anterior se existir
      const { error: deleteError } = await supabase.storage
        .from("avatars")
        .remove([filePath]);

      if (deleteError && deleteError.message !== "Object not found") {
        console.error("Error deleting old avatar:", deleteError);
      }

      // Upload novo avatar
      const { data, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressedBlob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });

      if (uploadError) {
        throw uploadError;
      }

      console.log("Avatar uploaded successfully:", data);

      // Obter URL público
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = urlData.publicUrl;
      console.log("Avatar URL:", avatarUrl);

      return avatarUrl;
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        variant: "destructive",
        title: "Erro ao fazer upload do avatar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteAvatar = async (userId: string): Promise<boolean> => {
    setUploading(true);
    try {
      console.log("Deleting avatar for user:", userId);
      
      const filePath = `${userId}/avatar.jpg`;

      const { error } = await supabase.storage
        .from("avatars")
        .remove([filePath]);

      if (error && error.message !== "Object not found") {
        throw error;
      }

      console.log("Avatar deleted successfully");
      return true;
    } catch (error) {
      console.error("Error deleting avatar:", error);
      toast({
        variant: "destructive",
        title: "Erro ao deletar avatar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
      return false;
    } finally {
      setUploading(false);
    }
  };

  return { uploadAvatar, deleteAvatar, uploading };
}
