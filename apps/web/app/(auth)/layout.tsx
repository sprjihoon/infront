export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-white px-6">
      <div className="w-full max-w-[430px]">{children}</div>
    </div>
  );
}
