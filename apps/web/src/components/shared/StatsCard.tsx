import { useState, useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    if (isNaN(target)) return;
    const start = ref.current;
    const startTime = performance.now();
    let frame = 0;
    const animate = () => {
      const progress = Math.min(Math.max((performance.now() - startTime) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      setCount(current);
      if (progress < 1) frame = requestAnimationFrame(animate);
      else ref.current = target;
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return count;
}

type StatsColor = "blue" | "green" | "purple" | "amber" | "red";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: StatsColor;
  sparkData?: number[];
  className?: string;
}

const colorMap: Record<
  StatsColor,
  { bg: string; text: string; trendUp: string; trendDown: string; border: string; spark: string }
> = {
  blue: {
    bg: "bg-teal-500/10",
    text: "text-teal-500",
    trendUp: "text-green-600",
    trendDown: "text-red-600",
    border: "border-l-teal-500",
    spark: "#14b8a6",
  },
  green: {
    bg: "bg-green-500/10",
    text: "text-green-500",
    trendUp: "text-green-600",
    trendDown: "text-red-600",
    border: "border-l-green-500",
    spark: "#22c55e",
  },
  purple: {
    bg: "bg-purple-500/10",
    text: "text-purple-500",
    trendUp: "text-green-600",
    trendDown: "text-red-600",
    border: "border-l-purple-500",
    spark: "#a855f7",
  },
  amber: {
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    trendUp: "text-green-600",
    trendDown: "text-red-600",
    border: "border-l-amber-500",
    spark: "#f59e0b",
  },
  red: {
    bg: "bg-red-500/10",
    text: "text-red-500",
    trendUp: "text-green-600",
    trendDown: "text-red-600",
    border: "border-l-red-500",
    spark: "#ef4444",
  },
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "blue",
  sparkData,
  className,
}: StatsCardProps) {
  const colors = colorMap[color];
  const isPositive = trend ? trend.value >= 0 : true;
  // Hook must run on every render; only use its result for numeric values.
  const counted = useCountUp(typeof value === 'number' ? value : 0);
  const animatedValue = typeof value === 'number' ? counted : null;

  const renderSparkline = (data: number[], sparkColor: string) => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const width = 120;
    const height = 32;
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');
    const areaPoints = `0,${height} ${points} ${width},${height}`;
    return (
      <svg width={width} height={height} className="mt-3 overflow-visible">
        <defs>
          <linearGradient id={`spark-${sparkColor}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sparkColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={sparkColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#spark-${sparkColor})`} />
        <polyline points={points} fill="none" stroke={sparkColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <Card
      className={cn(
        "animate-fade-in transition-all duration-200 hover:shadow-md border-l-[3px]",
        colors.border,
        className
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{animatedValue ?? value}</p>
          </div>
          <div className={cn("rounded-xl p-3", colors.bg)}>
            <Icon className={cn("h-6 w-6", colors.text)} />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1.5 text-sm">
            {isPositive ? (
              <TrendingUp className={cn("h-4 w-4", colors.trendUp)} />
            ) : (
              <TrendingDown className={cn("h-4 w-4", colors.trendDown)} />
            )}
            <span
              className={cn(
                "font-medium",
                isPositive ? colors.trendUp : colors.trendDown
              )}
            >
              {isPositive ? "+" : ""}
              {trend.value}%
            </span>
            <span className="text-muted-foreground">{trend.label}</span>
          </div>
        )}
        {sparkData && renderSparkline(sparkData, colors.spark)}
      </CardContent>
    </Card>
  );
}
