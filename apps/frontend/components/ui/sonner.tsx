"use client";

import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-neutral-900 group-[.toaster]:text-neutral-50 group-[.toaster]:border-neutral-800 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-neutral-400",
          actionButton:
            "group-[.toast]:bg-neutral-50 group-[.toast]:text-neutral-900",
          cancelButton:
            "group-[.toast]:bg-neutral-800 group-[.toast]:text-neutral-400",
          error:
            "group-[.toaster]:bg-red-950 group-[.toaster]:text-red-100 group-[.toaster]:border-red-900",
          success:
            "group-[.toaster]:bg-green-950 group-[.toaster]:text-green-100 group-[.toaster]:border-green-900",
          warning:
            "group-[.toaster]:bg-yellow-950 group-[.toaster]:text-yellow-100 group-[.toaster]:border-yellow-900",
          info: "group-[.toaster]:bg-blue-950 group-[.toaster]:text-blue-100 group-[.toaster]:border-blue-900",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
