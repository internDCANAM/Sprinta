import {
    createContext,
    useContext,
    useState,
    type ReactNode,
} from "react";

type ToastType = "success" | "error";

type Toast = {
    message: string;
    type: ToastType;
};

type ToastContextValue = {
    showToast: (message: string, type: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toast, setToast] = useState<Toast | null>(null);

    function showToast(message: string, type: ToastType) {
        setToast({ message, type });

        window.setTimeout(() => {
            setToast(null);
        }, 3000);
    }

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {toast && (
                <div
                    className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
                        toast.type === "success" ? "bg-green-700" : "bg-red-700"
                    }`}
                >
                    {toast.message}
                </div>
            )}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error("useToast must be used inside ToastProvider");
    }

    return context;
}