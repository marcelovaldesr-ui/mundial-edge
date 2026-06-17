import * as React from "react";
import { cn } from "@/lib/utils";

export const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-auto">
    <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
);
export const TableHeader = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className="[&_tr]:border-b border-border" {...p} />;
export const TableBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody className="[&_tr:last-child]:border-0" {...p} />;
export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn("border-b border-border transition-colors hover:bg-accent/40", className)} {...props} />
);
export const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn("h-11 px-3 text-left align-middle font-medium text-muted-foreground", className)} {...props} />
);
export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("px-3 py-3 align-middle", className)} {...props} />
);
