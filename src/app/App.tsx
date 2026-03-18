import { RouterProvider } from 'react-router';
import { BudgetProvider } from './context/BudgetContext';
import { router } from './routes';

export default function App() {
  return (
    <BudgetProvider>
      <RouterProvider router={router} />
    </BudgetProvider>
  );
}
