import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface FlowArrowProps {
  href: string;
  label?: string;
}

const FlowArrow = ({ href, label = "Next section" }: FlowArrowProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const arrowRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: 0.5,
        rootMargin: "0px 0px -100px 0px"
      }
    );

    if (arrowRef.current?.parentElement) {
      observer.observe(arrowRef.current.parentElement);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <a
      ref={arrowRef}
      href={href}
      aria-label={label}
      className={`flow-arrow absolute left-1/2 -bottom-16 transform -translate-x-1/2 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-float)] hover:shadow-[var(--shadow-elegant)] transition-all duration-300 hover:translate-y-0.5 flex items-center justify-center z-50 cursor-pointer ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <ChevronDown className="h-5 w-5" />
    </a>
  );
};

export default FlowArrow;