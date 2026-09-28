"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Send,
  User,
  Wallet,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

import { api } from "@/lib/api";

type Role = "sender" | "receiver";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^9[678]\d{8}$/;

const validateField = (name: string, value: string): string => {
  const v = value.trim();

  switch (name) {
    case "name":
      if (!v) return "Full name is required";
      if (v.length < 2) return "Name must be at least 2 characters";
      if (!/^[A-Za-z][A-Za-z\s.'-]*$/.test(v))
        return "Please enter a valid name";
      return "";

    case "email":
      if (!v) return "Email is required";
      if (!EMAIL_REGEX.test(v)) return "Please enter a valid email address";
      return "";

    case "phone": {
      if (!v) return "Phone number is required";
      const digits = v.replace(/[\s-]/g, "");
      if (!/^\d+$/.test(digits)) return "Phone number can only contain digits";
      if (!PHONE_REGEX.test(digits))
        return "Enter a valid 10-digit mobile number (e.g. 98XXXXXXXX)";
      return "";
    }

    case "password": {
      if (!value) return "Password is required";
      if (value.length < 8) return "Password must be at least 8 characters";
      if (!/[A-Za-z]/.test(value))
        return "Password must contain at least one letter";
      if (!/\d/.test(value)) return "Password must contain at least one number";
      return "";
    }

    case "address":
      if (v && v.length < 5) return "Address must be at least 5 characters";
      return "";

    default:
      return "";
  }
};

const getPasswordStrength = (pw: string) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
};

const STRENGTH_META = [
  { label: "Too weak", bar: "bg-red-500", text: "text-red-600" },
  { label: "Weak", bar: "bg-red-500", text: "text-red-600" },
  { label: "Fair", bar: "bg-amber-500", text: "text-amber-600" },
  { label: "Good", bar: "bg-yellow-500", text: "text-yellow-600" },
  { label: "Strong", bar: "bg-green-500", text: "text-green-600" },
  { label: "Very strong", bar: "bg-green-600", text: "text-green-600" },
];

export default function RegisterPage() {
  const router = useRouter();

  const [role, setRole] = useState<Role>("sender");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    address: "",
    country: "Nepal",
    preferredPayoutMethod: "bank",
  });

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [booting, setBooting] = useState(true);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const controls = useAnimation();

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 700);
    return () => clearTimeout(timer);
  }, []);

  const shakeCard = () => {
    controls.start({
      x: [0, -10, 10, -6, 6, 0],
      transition: { duration: 0.4, ease: "easeInOut" },
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    setForm((prev) => ({ ...prev, [name]: value }));

    if (touched[name]) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: validateField(name, value),
      }));
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    setTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors((prev) => ({
      ...prev,
      [name]: validateField(name, value),
    }));
  };

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    const errors: Record<string, string> = {
      name: validateField("name", form.name),
      email: validateField("email", form.email),
      phone: validateField("phone", form.phone),
      password: validateField("password", form.password),
      address: validateField("address", form.address),
    };

    setTouched({
      name: true,
      email: true,
      phone: true,
      password: true,
      address: true,
    });
    setFieldErrors(errors);

    const firstError = Object.values(errors).find(Boolean);
    if (firstError) {
      shakeCard();
      toast.error(firstError, { id: "register-error" });
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        role,
        address: form.address.trim(),
        country: form.country.trim(),
        ...(role === "receiver" && {
          preferredPayoutMethod: form.preferredPayoutMethod,
        }),
      };

      const response = await api("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const message = `Registration successful. Your Remit ID is ${response.user.remitId}`;

      setSuccess(message);
      toast.success("Account created successfully!", {
        id: "register-success",
      });

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Registration failed. Please try again.";

      setError(message);
      shakeCard();
      toast.error(message, { id: "register-error" });
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(form.password);
  const strength = STRENGTH_META[passwordStrength];

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-10">
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

      <div className="w-full max-w-2xl">
        {booting ? (
          <RegisterSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
          >
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                Create RemitChain Account
              </h1>

              <p className="mt-2 text-gray-500">
                Register as a sender or receiver
              </p>
            </div>

            {/* Role Selection */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <RoleCard
                active={role === "sender"}
                onClick={() => handleRoleChange("sender")}
                icon={<Send className="h-5 w-5" />}
                title="Sender"
                description="Send money through RemitChain"
              />

              <RoleCard
                active={role === "receiver"}
                onClick={() => handleRoleChange("receiver")}
                icon={<Wallet className="h-5 w-5" />}
                title="Receiver"
                description="Receive remittance payments"
              />
            </div>

            {/* Error */}
            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success */}
            <AnimatePresence initial={false}>
              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{success}</span>
                    </div>
                    <p className="mt-1 text-xs">Redirecting you to login...</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Registration Form */}
            <motion.form
              animate={controls}
              onSubmit={handleSubmit}
              className="space-y-5"
              noValidate
            >
              {/* Name */}
              <InputField
                id="name"
                name="name"
                label="Full Name"
                required
                icon={<User className="h-5 w-5" />}
                value={form.name}
                placeholder="Enter your name"
                autoComplete="name"
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.name ? fieldErrors.name : ""}
                valid={
                  !!touched.name && !!form.name.trim() && !fieldErrors.name
                }
              />

              {/* Email */}
              <InputField
                id="email"
                name="email"
                type="email"
                label="Email"
                required
                icon={<Mail className="h-5 w-5" />}
                value={form.email}
                placeholder="you@example.com"
                autoComplete="email"
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.email ? fieldErrors.email : ""}
                valid={
                  !!touched.email && !!form.email.trim() && !fieldErrors.email
                }
              />

              {/* Phone */}
              <InputField
                id="phone"
                name="phone"
                type="tel"
                label="Phone Number"
                required
                icon={<Phone className="h-5 w-5" />}
                value={form.phone}
                placeholder="98XXXXXXXX"
                autoComplete="tel"
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.phone ? fieldErrors.phone : ""}
                valid={
                  !!touched.phone && !!form.phone.trim() && !fieldErrors.phone
                }
              />

              {/* Password */}
              <div>
                <InputField
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  label="Password"
                  required
                  icon={<Lock className="h-5 w-5" />}
                  value={form.password}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.password ? fieldErrors.password : ""}
                  rightSlot={
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
                  }
                />

                {/* Password strength meter */}
                <AnimatePresence initial={false}>
                  {form.password && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3">
                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                                i < passwordStrength
                                  ? strength.bar
                                  : "bg-gray-200"
                              }`}
                            />
                          ))}
                        </div>

                        <p className={`mt-1.5 text-xs ${strength.text}`}>
                          Password strength: {strength.label}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Address */}
              <InputField
                id="address"
                name="address"
                label="Address"
                icon={<MapPin className="h-5 w-5" />}
                value={form.address}
                placeholder="Enter your address"
                autoComplete="street-address"
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.address ? fieldErrors.address : ""}
                valid={
                  !!touched.address &&
                  !!form.address.trim() &&
                  !fieldErrors.address
                }
              />

              {/* Country */}
              <InputField
                id="country"
                name="country"
                label="Country"
                icon={<Globe className="h-5 w-5" />}
                value={form.country}
                placeholder="Country"
                autoComplete="country-name"
                onChange={handleChange}
                onBlur={handleBlur}
              />

              {/* Receiver-only payout method */}
              <AnimatePresence initial={false}>
                {role === "receiver" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <label
                      htmlFor="preferredPayoutMethod"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Preferred Payout Method
                    </label>

                    <div className="relative">
                      <Banknote className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

                      <select
                        id="preferredPayoutMethod"
                        name="preferredPayoutMethod"
                        value={form.preferredPayoutMethod}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className="w-full appearance-none rounded-lg border border-gray-300 bg-white pl-11 pr-10 py-3 text-gray-900 outline-none transition focus:border-green-600 focus:ring-1 focus:ring-green-600"
                      >
                        <option value="bank">Bank Account</option>
                        <option value="wallet">Digital Wallet</option>
                        <option value="cash">Cash Pickup</option>
                      </select>

                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M3 4.5L6 7.5L9 4.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading || !!success}
                whileHover={loading || success ? undefined : { scale: 1.01 }}
                whileTap={loading || success ? undefined : { scale: 0.99 }}
                transition={{ duration: 0.15 }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  `Register as ${role}`
                )}
              </motion.button>
            </motion.form>

            {/* Login */}
            <div className="mt-6 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-green-600 hover:text-green-700"
              >
                Login
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

/* ---------------------------------- */
/* Reusable field                      */
/* ---------------------------------- */

function InputField({
  id,
  name,
  label,
  type = "text",
  value,
  placeholder,
  icon,
  required,
  autoComplete,
  error,
  valid,
  rightSlot,
  onChange,
  onBlur,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  value: string;
  placeholder?: string;
  icon: React.ReactNode;
  required?: boolean;
  autoComplete?: string;
  error?: string;
  valid?: boolean;
  rightSlot?: React.ReactNode;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label} {required && "*"}
      </label>

      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
          {icon}
        </span>

        <input
          id={id}
          name={name}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={!!error}
          className={`w-full rounded-lg border py-3 pl-11 pr-11 text-gray-900 placeholder:text-gray-400 outline-none transition ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500"
              : "border-gray-300 focus:border-green-600 focus:ring-1 focus:ring-green-600"
          }`}
        />

        {rightSlot ? (
          rightSlot
        ) : (
          <AnimatePresence>
            {valid && (
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
        )}
      </div>

      <FieldError message={error} />
    </div>
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

/* ---------------------------------- */
/* Role card                           */
/* ---------------------------------- */

function RoleCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={`relative rounded-lg border p-4 text-left transition ${
        active
          ? "border-green-600 bg-green-50"
          : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            active ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500"
          }`}
        >
          {icon}
        </span>

        <AnimatePresence>
          {active && (
            <motion.span
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.15 }}
            >
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 font-semibold text-gray-900">{title}</div>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </motion.button>
  );
}

/* ---------------------------------- */
/* Skeleton                            */
/* ---------------------------------- */

function RegisterSkeleton() {
  return (
    <div
      className="animate-pulse rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
      aria-hidden="true"
    >
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="h-9 w-72 rounded-lg bg-gray-200" />
        <div className="h-4 w-52 rounded bg-gray-200" />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="h-28 rounded-lg bg-gray-200" />
        <div className="h-28 rounded-lg bg-gray-200" />
      </div>

      <div className="space-y-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="h-12 w-full rounded-lg bg-gray-200" />
          </div>
        ))}

        <div className="h-12 w-full rounded-lg bg-gray-200" />
      </div>

      <div className="mx-auto mt-6 h-4 w-52 rounded bg-gray-200" />
    </div>
  );
}
