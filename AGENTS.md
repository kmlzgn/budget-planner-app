# Codebase Rules

Architecture:
- React 18 + Vite SPA
- Context state: src/app/context/BudgetContext.tsx
- Types: src/app/types.ts
- Calculations: src/app/utils/budgetCalculations.ts
- Pages: src/app/pages/*
- Components: src/app/components/*
- Persistence: localStorage (budgetPlannerData)

Guidelines:
- minimal diffs
- avoid any
- reuse utilities
- preserve localStorage compatibility

Never rewrite large page components if a utility change can solve the task.