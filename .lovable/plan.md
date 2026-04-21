

## Fix: Report Generation Error + CDS UI Readability

### Problem 1: "supabaseKey is required" error
The `generate-report` edge function on line 63 reads `SUPABASE_PUBLISHABLE_KEY`, but the available secret is `SUPABASE_ANON_KEY`. This returns `undefined`, crashing the function.

**Fix:** Change `Deno.env.get("SUPABASE_PUBLISHABLE_KEY")` to `Deno.env.get("SUPABASE_ANON_KEY")` in `supabase/functions/generate-report/index.ts`.

### Problem 2: CDS alerts hard to read (red/blue on dark background)
In `ConsultationEdit.tsx`, the severity colors use low-opacity classes that are nearly invisible on dark theme:
- `critical`: `bg-destructive/10 text-destructive` — red on dark = poor contrast
- `info`: `bg-primary/10 text-primary` — blue on dark = poor contrast

**Fix:** Increase opacity and use lighter text colors:
- `critical`: `bg-destructive/20 text-red-300 border-red-500/40`
- `warning`: `bg-amber-500/20 text-amber-300 border-amber-500/40`
- `info`: `bg-blue-500/20 text-blue-300 border-blue-500/40`

Also update the alert title and description text to use higher contrast colors (e.g., `text-red-200`, `text-blue-200`).

### Files changed
1. `supabase/functions/generate-report/index.ts` — fix env var name
2. `src/pages/ConsultationEdit.tsx` — improve CDS alert color contrast

