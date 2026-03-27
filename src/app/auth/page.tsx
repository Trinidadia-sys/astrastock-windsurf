import Auth from '@/components/Auth';

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-xl" />
      <Auth />
    </div>
  );
}
