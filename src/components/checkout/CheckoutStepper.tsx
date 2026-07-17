import { Check } from "lucide-react";

type Step = {
  id: number;
  label: string;
};

const steps: Step[] = [
  { id: 1, label: "Address" },
  { id: 2, label: "Order Summary" },
  { id: 3, label: "Payment" },
];

export function CheckoutStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-6 flex items-center justify-between px-2 sm:px-6 relative">
      <div className="absolute left-0 top-1/2 -z-10 h-[2px] w-full -translate-y-1/2 bg-border-light"></div>
      
      {/* Progress Bar Fill */}
      <div 
        className="absolute left-0 top-1/2 -z-10 h-[2px] -translate-y-1/2 bg-blue-600 transition-all duration-300" 
        style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
      ></div>

      {steps.map((step) => {
        const isCompleted = step.id < currentStep;
        const isCurrent = step.id === currentStep;

        return (
          <div key={step.id} className="flex flex-col items-center bg-[#fafafa] px-2 sm:px-4">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                isCompleted
                  ? "bg-blue-600 text-white"
                  : isCurrent
                  ? "bg-blue-600 text-white"
                  : "bg-white border-2 border-border-light text-ink-muted"
              }`}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : step.id}
            </div>
            <span
              className={`mt-2 text-xs font-medium sm:text-sm ${
                isCurrent || isCompleted ? "text-ink" : "text-ink-muted"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
