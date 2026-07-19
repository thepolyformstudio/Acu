declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function openRazorpayCheckout(options: {
  key: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  email: string;
  onSuccess: (payload: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  onError: (error: Error) => void;
}) {
  const rzp = new window.Razorpay({
    key: options.key,
    amount: options.amount,
    currency: options.currency,
    name: options.name,
    description: options.description,
    prefill: { email: options.email },
    method: { upi: true },
    modal: {
      ondismiss: () => options.onError(new Error("Payment cancelled")),
    },
    handler: function (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
      options.onSuccess({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature,
      });
    },
  });
  rzp.open();
}
