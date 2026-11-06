// Fixture: proves react-app.json compiles a React component with DOM types.
import { useState } from 'react';

export function Counter({ start = 0 }: { start?: number }) {
  const [count, setCount] = useState(start);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {count} {document.title}
    </button>
  );
}
