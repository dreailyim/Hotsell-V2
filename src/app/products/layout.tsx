
import MainLayout from "@/app/(main)/layout";

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
