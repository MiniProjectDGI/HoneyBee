import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authApi } from '../../api';
import { Button, Input, Select, Card } from '../../components/ui';
import { getApiErrorMessage } from '../../utils';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  role: z.enum(['CONSUMER', 'BEEKEEPER', 'COLLECTION_CENTER', 'PROCESSOR', 'QUALITY_LAB', 'DISTRIBUTOR', 'RETAILER']),
});

type FormData = z.infer<typeof schema>;

const ROLE_OPTIONS = [
  { value: 'CONSUMER', label: 'Consumer — Verify honey quality' },
  { value: 'BEEKEEPER', label: 'Beekeeper — Manage hives and batches' },
  { value: 'COLLECTION_CENTER', label: 'Collection Center' },
  { value: 'PROCESSOR', label: 'Processing Unit' },
  { value: 'QUALITY_LAB', label: 'Quality Laboratory' },
  { value: 'DISTRIBUTOR', label: 'Distributor' },
  { value: 'RETAILER', label: 'Retailer' },
];

export default function RegisterPage() {
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'CONSUMER' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => authApi.register(data),
    onSuccess: () => {
      toast.success('Account created! Please sign in.');
      navigate('/login');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-2xl shadow-lg">🍯</div>
            <div className="text-left">
              <div className="font-bold text-slate-900 text-xl">Honey Chain</div>
              <div className="text-xs text-slate-500">Traceability Platform</div>
            </div>
          </Link>
        </div>

        <Card>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Create account</h1>
          <p className="text-sm text-slate-500 mb-6">Join the Honey Chain traceability platform</p>

          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" placeholder="Arjun" error={errors.firstName?.message} {...register('firstName')} />
              <Input label="Last name" placeholder="Singh" error={errors.lastName?.message} {...register('lastName')} />
            </div>
            <Input label="Email address" type="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
            <Input label="Password" type="password" placeholder="••••••••" error={errors.password?.message} hint="Min 8 characters, 1 uppercase, 1 number" {...register('password')} />
            <Select
              label="Account type"
              options={ROLE_OPTIONS}
              error={errors.role?.message}
              {...register('role')}
            />

            <Button type="submit" className="w-full" size="lg" loading={mutation.isPending}>
              Create account
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-amber-600 font-medium hover:text-amber-700">Sign in</Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
