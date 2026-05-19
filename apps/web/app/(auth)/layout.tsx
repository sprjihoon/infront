export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-y-auto bg-white px-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-[430px] py-10">{children}</div>
    </div>
  );
}
