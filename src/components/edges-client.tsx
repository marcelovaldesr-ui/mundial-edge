"use client";

import { useState } from "react";
import { EdgeTable } from "@/components/edge-table";
import { BankrollInput } from "@/components/bankroll-input";
import type { Edge } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

export function EdgesClient({ edges }: { edges: Edge[] }) {
  const [bankroll, setBankroll] = useState(0);

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <BankrollInput onChange={setBankroll} />
        <EdgeTable edges={edges} bankroll={bankroll} />
      </CardContent>
    </Card>
  );
}
