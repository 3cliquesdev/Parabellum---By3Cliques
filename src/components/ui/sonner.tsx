import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#0d0d0d] group-[.toaster]:text-white group-[.toaster]:border-[#262626] group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-[#999999]",
          actionButton: "group-[.toast]:bg-[#22c55e] group-[.toast]:text-black",
          cancelButton: "group-[.toast]:bg-[#202020] group-[.toast]:text-[#999999]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
