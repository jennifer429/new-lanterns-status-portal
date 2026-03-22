import { ChevronRight, Home } from "lucide-react";
import { Link } from "wouter";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  orgSlug: string;
  items: BreadcrumbItem[];
}

export function PageBreadcrumb({ orgSlug, items }: PageBreadcrumbProps) {
  return (
    <div className="border-b border-border/30 bg-muted/20 px-4 sm:px-6 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-1 text-xs text-muted-foreground">
        <Link href={`/org/${orgSlug}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
          <Home className="w-3 h-3" />
          <span>Dashboard</span>
        </Link>
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground/80">{item.label}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
