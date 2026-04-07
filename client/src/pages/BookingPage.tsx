/**
 * Invitation-only training booking page — /book/:token
 *
 * 4-step wizard matching the New Lantern design system:
 *   1. Your info     — name, email, org, phone (pre-filled from invitation)
 *   2. Training type — Admin Training vs Technologist Training
 *   3. Date & time   — pick a Tue/Wed/Thu slot
 *   4. Confirm       — review + submit
 *
 * Access is gated by a Pylon-issued invitation token in the URL.
 */

import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Calendar, Clock, User, Monitor, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4;

interface FormData {
  fullName: string;
  email: string;
  organization: string;
  phone: string;
  trainingType: "admin" | "technologist" | "";
  selectedDate: string; // YYYY-MM-DD
  selectedTime: string; // e.g. "10:00 AM"
  notes: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRAINING_OPTIONS = [
  {
    id: "admin" as const,
    title: "Admin Training",
    description: "Learn how to manage workflows, users, and settings in the New Lantern platform.",
    icon: <User className="h-6 w-6" />,
  },
  {
    id: "technologist" as const,
    title: "Technologist Training",
    description: "Hands-on training for technologists on daily operations and AI-assisted workflows.",
    icon: <Monitor className="h-6 w-6" />,
  },
];

// Generate the next 30 days that are Tue (2), Wed (3), or Thu (4)
function getAvailableDates(): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; dates.length < 12; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const day = d.getDay();
    if (day === 2 || day === 3 || day === 4) {
      dates.push(d);
    }
  }
  return dates;
}

const TIME_SLOTS = [
  "9:00 AM", "9:30 AM",
  "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM",
  "1:00 PM", "1:30 PM",
  "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM",
];

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00"); // noon to avoid timezone offset
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function toYMD(date: Date): string {
  return date.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { num: 1, label: "Your info" },
  { num: 2, label: "Training type" },
  { num: 3, label: "Date & time" },
  { num: 4, label: "Confirm" },
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, idx) => (
        <div key={s.num} className="flex items-center">
          {/* Circle */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors",
                current === s.num
                  ? "bg-purple-600 text-white"
                  : current > s.num
                  ? "bg-purple-900 text-purple-300 border border-purple-600"
                  : "bg-white/10 text-white/40 border border-white/20"
              )}
            >
              {current > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
            </div>
            <span
              className={cn(
                "text-sm font-medium whitespace-nowrap",
                current === s.num ? "text-white" : "text-white/40"
              )}
            >
              {s.label}
            </span>
          </div>
          {/* Connector line */}
          {idx < STEPS.length - 1 && (
            <div className={cn("h-px w-8 mx-3", current > s.num ? "bg-purple-600" : "bg-white/20")} />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invalid / error state
// ---------------------------------------------------------------------------

function InvalidInvite({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0e0a1a] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">NL</span>
        </div>
        <span className="text-white/60 text-sm">New Lantern</span>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Invitation</h1>
          <p className="text-white/60 mb-6">{message}</p>
          <p className="text-white/40 text-sm">
            Questions? Email{" "}
            <a href="mailto:megan@newlantern.ai" className="text-purple-400 hover:underline">
              megan@newlantern.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success state
// ---------------------------------------------------------------------------

function BookingSuccess({ data }: { data: FormData }) {
  return (
    <div className="min-h-screen bg-[#0e0a1a] flex flex-col">
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">NL</span>
        </div>
        <span className="text-white/60 text-sm">Admin and Technologist Training</span>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-lg">
          <div className="w-20 h-20 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">You're booked!</h1>
          <p className="text-white/60 mb-8 text-lg">
            Your <span className="text-white font-medium capitalize">{data.trainingType} Training</span> with Megan has been scheduled.
          </p>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-left mb-8 space-y-3">
            <div className="flex items-center gap-3 text-white/80">
              <Calendar className="h-4 w-4 text-purple-400 shrink-0" />
              <span>{formatDate(data.selectedDate)}</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <Clock className="h-4 w-4 text-purple-400 shrink-0" />
              <span>{data.selectedTime} · 30 minutes</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <User className="h-4 w-4 text-purple-400 shrink-0" />
              <span>{data.fullName} · {data.email}</span>
            </div>
          </div>

          <p className="text-white/40 text-sm">
            A confirmation has been recorded. Questions?{" "}
            <a href="mailto:megan@newlantern.ai" className="text-purple-400 hover:underline">
              megan@newlantern.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main booking page
// ---------------------------------------------------------------------------

export default function BookingPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const [step, setStep] = useState<Step>(1);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormData>({
    fullName: "",
    email: "",
    organization: "",
    phone: "",
    trainingType: "",
    selectedDate: "",
    selectedTime: "",
    notes: "",
  });

  const availableDates = getAvailableDates();

  // Validate token on mount
  const tokenQuery = trpc.booking.validateToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  // Pre-fill form fields once invitation data loads
  useEffect(() => {
    if (tokenQuery.data) {
      setForm(prev => ({
        ...prev,
        fullName: prev.fullName || tokenQuery.data.prefillName,
        email: prev.email || tokenQuery.data.prefillEmail,
        organization: prev.organization || tokenQuery.data.prefillOrg,
      }));
    }
  }, [tokenQuery.data]);

  const submitMutation = trpc.booking.submitBooking.useMutation({
    onSuccess() {
      setSubmitted(true);
    },
    onError(err) {
      toast.error(err.message || "Failed to submit booking. Please try again.");
    },
  });

  // ------------- Loading / error states -----------------------------------

  if (!token) return <InvalidInvite message="No invitation token was provided in the URL." />;

  if (tokenQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#0e0a1a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (tokenQuery.isError) {
    return <InvalidInvite message={tokenQuery.error?.message ?? "This invitation link is invalid or has expired."} />;
  }

  if (submitted) return <BookingSuccess data={form} />;

  // ------------- Step validation ------------------------------------------

  function canProceed(): boolean {
    if (step === 1) return !!(form.fullName.trim() && form.email.trim());
    if (step === 2) return !!form.trainingType;
    if (step === 3) return !!(form.selectedDate && form.selectedTime);
    return true;
  }

  function handleNext() {
    if (!canProceed()) return;
    if (step < 4) setStep((s) => (s + 1) as Step);
  }

  function handleBack() {
    if (step > 1) setStep((s) => (s - 1) as Step);
  }

  function handleSubmit() {
    if (submitMutation.isPending) return;
    submitMutation.mutate({
      token,
      fullName: form.fullName,
      email: form.email,
      organization: form.organization || undefined,
      phone: form.phone || undefined,
      trainingType: form.trainingType as "admin" | "technologist",
      selectedDate: form.selectedDate,
      selectedTime: form.selectedTime,
      notes: form.notes || undefined,
    });
  }

  // ------------- Render ----------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0e0a1a] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">NL</span>
        </div>
        <span className="text-white/60 text-sm">Admin and Technologist Training</span>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center px-4 py-12">
        {/* Title */}
        <div className="w-full max-w-2xl mb-8">
          <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
            New Lantern{" "}
            <span className="italic text-purple-400 font-bold">Admin and Technologist</span>
            <br />
            Training
          </h1>
          <p className="text-white/60">
            Schedule a personalized 30-minute admin or technologist training with Megan&nbsp;·&nbsp;Tue, Wed &amp; Thu
          </p>
        </div>

        {/* Step indicator */}
        <div className="w-full max-w-2xl mb-8">
          <StepIndicator current={step} />
        </div>

        {/* Form card */}
        <div className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-2xl p-8">
          {/* ---- Step 1: Your info ---- */}
          {step === 1 && (
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-5">
                Your Information
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-white/80 text-sm">
                    Full name <span className="text-purple-400">*</span>
                  </Label>
                  <Input
                    placeholder="Jane Smith"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-purple-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/80 text-sm">
                    Email address <span className="text-purple-400">*</span>
                  </Label>
                  <Input
                    type="email"
                    placeholder="jane@hospital.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-purple-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/80 text-sm">Organization / Facility</Label>
                  <Input
                    placeholder="General Hospital"
                    value={form.organization}
                    onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                    className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-purple-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/80 text-sm">Phone number</Label>
                  <Input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ---- Step 2: Training type ---- */}
          {step === 2 && (
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-5">
                Select Training Type
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TRAINING_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setForm((f) => ({ ...f, trainingType: opt.id }))}
                    className={cn(
                      "p-5 rounded-xl border text-left transition-all",
                      form.trainingType === opt.id
                        ? "border-purple-500 bg-purple-600/15 ring-1 ring-purple-500"
                        : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/8"
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
                        form.trainingType === opt.id ? "bg-purple-600/30 text-purple-300" : "bg-white/10 text-white/50"
                      )}
                    >
                      {opt.icon}
                    </div>
                    <p className="font-semibold text-white mb-1">{opt.title}</p>
                    <p className="text-white/50 text-sm leading-relaxed">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---- Step 3: Date & time ---- */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Date picker */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
                  Select a Date
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableDates.map((d) => {
                    const ymd = toYMD(d);
                    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
                    const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    return (
                      <button
                        key={ymd}
                        onClick={() => setForm((f) => ({ ...f, selectedDate: ymd }))}
                        className={cn(
                          "p-3 rounded-lg border text-center transition-all",
                          form.selectedDate === ymd
                            ? "border-purple-500 bg-purple-600/15 ring-1 ring-purple-500"
                            : "border-white/15 bg-white/5 hover:border-white/30"
                        )}
                      >
                        <p className="text-xs text-white/50 mb-0.5">{weekday}</p>
                        <p className="text-sm font-medium text-white">{monthDay}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time picker */}
              {form.selectedDate && (
                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
                    Select a Time
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {TIME_SLOTS.map((t) => (
                      <button
                        key={t}
                        onClick={() => setForm((f) => ({ ...f, selectedTime: t }))}
                        className={cn(
                          "py-2.5 px-3 rounded-lg border text-sm text-center transition-all",
                          form.selectedTime === t
                            ? "border-purple-500 bg-purple-600/15 ring-1 ring-purple-500 text-white font-medium"
                            : "border-white/15 bg-white/5 hover:border-white/30 text-white/70"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- Step 4: Confirm ---- */}
          {step === 4 && (
            <div className="space-y-5">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-5">
                Review &amp; Confirm
              </p>

              <div className="space-y-3">
                {/* Who */}
                <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                  <User className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-white/40 mb-0.5">Attendee</p>
                    <p className="text-white font-medium">{form.fullName}</p>
                    <p className="text-white/60 text-sm">{form.email}</p>
                    {form.organization && <p className="text-white/40 text-sm">{form.organization}</p>}
                  </div>
                </div>

                {/* Training type */}
                <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                  <Monitor className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-white/40 mb-0.5">Training Type</p>
                    <p className="text-white font-medium capitalize">{form.trainingType} Training</p>
                    <p className="text-white/50 text-sm">30 minutes · with Megan</p>
                  </div>
                </div>

                {/* Date & time */}
                <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                  <Calendar className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-white/40 mb-0.5">Date &amp; Time</p>
                    <p className="text-white font-medium">{formatDate(form.selectedDate)}</p>
                    <p className="text-white/60 text-sm">{form.selectedTime}</p>
                  </div>
                </div>
              </div>

              {/* Optional notes */}
              <div className="space-y-1.5 mt-2">
                <Label className="text-white/60 text-sm">Notes (optional)</Label>
                <textarea
                  rows={3}
                  placeholder="Anything Megan should know before the session…"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg bg-white/5 border border-white/15 text-white placeholder:text-white/30 text-sm px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="w-full max-w-2xl mt-6 flex items-center justify-between">
          <div>
            {step > 1 && (
              <Button
                variant="ghost"
                onClick={handleBack}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>

          <div>
            {step < 4 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="bg-purple-600 hover:bg-purple-500 text-white px-6 disabled:opacity-40"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="bg-purple-600 hover:bg-purple-500 text-white px-8 disabled:opacity-40"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Booking…
                  </>
                ) : (
                  <>
                    Confirm Booking
                    <CheckCircle2 className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-4 text-center text-white/30 text-xs">
        Powered by New Lantern AI&nbsp;·&nbsp;Questions?{" "}
        <a href="mailto:megan@newlantern.ai" className="text-purple-400 hover:underline">
          megan@newlantern.ai
        </a>
      </footer>
    </div>
  );
}
