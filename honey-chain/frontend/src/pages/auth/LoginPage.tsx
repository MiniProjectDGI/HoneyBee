import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Button, Input, Card } from '../../components/ui';
import { getApiErrorMessage } from '../../utils';
import type { AuthTokens } from '../../types';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => authApi.login(data.email, data.password),
    onSuccess: (response) => {
      const tokens = response.data.data as AuthTokens;
      setAuth(tokens.user as Parameters<typeof setAuth>[0], tokens.accessToken, tokens.refreshToken);
      toast.success(`Welcome back, ${tokens.user.firstName}!`);
      navigate('/dashboard');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-2xl shadow-lg">
              🍯
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-900 text-xl">Honey Chain</div>
              <div className="text-xs text-slate-500">Traceability Platform</div>
            </div>
          </Link>
        </div>

        <Card>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-6">Enter your credentials to access the platform</p>

          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={mutation.isPending}
            >
              Sign in
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-amber-600 font-medium hover:text-amber-700">
                Create account
              </Link>
            </p>
          </div>
        </Card>

        <p className="text-xs text-center text-slate-400 mt-6">
          <Link to="/verify/scan" className="hover:text-slate-600">Scan a QR code</Link>
          {' · '}
          <Link to="/" className="hover:text-slate-600">Back to homepage</Link>
        </p>
      </div>
    </div>
  );
}
