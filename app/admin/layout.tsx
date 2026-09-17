import { AdminSidebar } from "@/components/admin-sidebar";
import { DemoBanner } from "@/components/demo-banner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <AdminSidebar />
      <div className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <div className="mb-6">
          <DemoBanner message="后台为占位界面，尚未接入登录与权限。列表数据来自演示数据集。" />
        </div>
        {children}
      </div>
    </div>
  );
}
