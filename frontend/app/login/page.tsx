"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { api } from "@/lib/api";
import { getRoleHomeRoute } from "@/lib/roles";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (value: string) => {
  if (!value.trim()) return "Email is required";
  if (!EMAIL_REGEX.test(value.trim()))
    return "Please enter a valid email address";
  return "";
};

const validatePassword = (value: string) => {
  if (!value) return "Password is required";
  return "";
};

type LoginResponse = {
  user?: {
    role?: unknown;
  };
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [touched, setTouched] = useState<{
    email?: boolean;
    password?: boolean;
  }>({});
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const [booting, setBooting] = useState(true);

  const controls = useAnimation();

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 700);
    return () => clearTimeout(timer);
  }, []);

  const emailError = touched.email ? fieldErrors.email || "" : "";
  const passwordError = touched.password ? fieldErrors.password || "" : "";
  const emailValid = !!email && !validateEmail(email) && touched.email;

  const shakeCard = () => {
    controls.start({
      x: [0, -10, 10, -6, 6, 0],
      transition: { duration: 0.4, ease: "easeInOut" },
    });
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const nextErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };

    setTouched({ email: true, password: true });
    setFieldErrors(nextErrors);
    setError("");

    if (nextErrors.email || nextErrors.password) {
      shakeCard();
      toast.error(nextErrors.email || nextErrors.password, {
        id: "login-error",
      });
      return;
    }

    setLoading(true);

    try {
      const data = (await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })) as LoginResponse;

      const roleHome = getRoleHomeRoute(data.user?.role);

      if (!roleHome) {
        throw new Error(
          "Your account has an unsupported role. Please contact support.",
        );
      }

      toast.success("Welcome back! Redirecting…", { id: "login-success" });

      router.replace(roleHome);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";

      setError(message);
      shakeCard();
      toast.error(message, { id: "login-error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: "10px",
            background: "#ffffff",
            color: "#111827",
            border: "1px solid #e5e7eb",
            fontSize: "14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          },
          success: { iconTheme: { primary: "#16a34a", secondary: "#ffffff" } },
          error: { iconTheme: { primary: "#dc2626", secondary: "#ffffff" } },
        }}
      />

      <div className="w-full max-w-md">
        {booting ? (
          <LoginSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">RemitChain</h1>

              <p className="mt-2 text-gray-500">Login to your account</p>
            </div>

            <motion.div
              animate={controls}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
            >
              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email
                  </label>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

                    <input
                      id="email"
                      type="email"
                      value={email}
                      autoComplete="email"
                      onChange={(e) => {
                        const value = e.target.value;
                        setEmail(value);
                        if (touched.email) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            email: validateEmail(value),
                          }));
                        }
                      }}
                      onBlur={() => {
                        setTouched((prev) => ({ ...prev, email: true }));
                        setFieldErrors((prev) => ({
                          ...prev,
                          email: validateEmail(email),
                        }));
                      }}
                      placeholder="you@example.com"
                      aria-invalid={!!emailError}
                      className={`w-full rounded-lg border py-3 pl-11 pr-11 outline-none transition ${
                        emailError
                          ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                          : "border-gray-300 focus:border-green-600 focus:ring-1 focus:ring-green-600"
                      }`}
                    />

                    <AnimatePresence>
                      {emailValid && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          transition={{ duration: 0.15 }}
                          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                        >
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  <FieldError message={emailError} />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Password
                  </label>

                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      autoComplete="current-password"
                      onChange={(e) => {
                        const value = e.target.value;
                        setPassword(value);
                        if (touched.password) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            password: validatePassword(value),
                          }));
                        }
                      }}
                      onBlur={() => {
                        setTouched((prev) => ({ ...prev, password: true }));
                        setFieldErrors((prev) => ({
                          ...prev,
                          password: validatePassword(password),
                        }));
                      }}
                      placeholder="••••••••"
                      aria-invalid={!!passwordError}
                      className={`w-full rounded-lg border py-3 pl-11 pr-11 outline-none transition ${
                        passwordError
                          ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                          : "border-gray-300 focus:border-green-600 focus:ring-1 focus:ring-green-600"
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={showPassword ? "hide" : "show"}
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          transition={{ duration: 0.15 }}
                          className="block"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </motion.span>
                      </AnimatePresence>
                    </button>
                  </div>

                  <FieldError message={passwordError} />
                </div>

                <AnimatePresence initial={false}>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={loading ? undefined : { scale: 1.01 }}
                  whileTap={loading ? undefined : { scale: 0.99 }}
                  transition={{ duration: 0.15 }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Login"
                  )}
                </motion.button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-500">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  className="font-medium text-green-600 hover:text-green-700"
                >
                  Register
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

function FieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: "auto", marginTop: 8 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-1.5 overflow-hidden text-sm text-red-600"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function LoginSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="h-9 w-48 rounded-lg bg-gray-200" />
        <div className="h-4 w-40 rounded bg-gray-200" />
      </div>

      <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <div className="h-4 w-14 rounded bg-gray-200" />
          <div className="h-12 w-full rounded-lg bg-gray-200" />
        </div>

        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-gray-200" />
          <div className="h-12 w-full rounded-lg bg-gray-200" />
        </div>

        <div className="h-12 w-full rounded-lg bg-gray-200" />

        <div className="mx-auto h-4 w-48 rounded bg-gray-200" />
      </div>
    </div>
  );
}
