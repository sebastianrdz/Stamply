"use client";

import { useActionState, useState } from "react";
import { createProgram, type ProgramFormState } from "@/lib/programs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const initialState: ProgramFormState = {};

export function ProgramForm() {
  const [state, formAction, pending] = useActionState(
    createProgram,
    initialState,
  );
  const [type, setType] = useState<"stamp" | "points">("stamp");

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Program name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Coffee lovers card"
          autoFocus
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">Type</Label>
          <Select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "stamp" | "points")}
          >
            <option value="stamp">Stamp card</option>
            <option value="points">Points</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal">
            {type === "points" ? "Points to reward" : "Stamps to reward"}
          </Label>
          <Input
            id="goal"
            name="goal"
            type="number"
            min={1}
            max={1000}
            defaultValue={type === "points" ? 100 : 10}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reward_description">Reward</Label>
        <Input
          id="reward_description"
          name="reward_description"
          placeholder="A free coffee of your choice"
          required
        />
      </div>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create program"}
        </Button>
      </div>
    </form>
  );
}
