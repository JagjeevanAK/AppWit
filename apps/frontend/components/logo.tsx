export default function Logo({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Stylized 'A' logo */}
            <path
                d="M50 10 L15 85 L30 85 L38 65 L62 65 L70 85 L85 85 L50 10 Z M50 30 L58 55 L42 55 L50 30 Z"
                fill="currentColor"
            />
        </svg>
    );
}
